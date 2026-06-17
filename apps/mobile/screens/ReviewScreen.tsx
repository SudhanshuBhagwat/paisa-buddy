import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Svg, { Circle, Polyline, Line, Path } from 'react-native-svg'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Sheet } from '../components/Sheet'
import { TypePicker } from '../components/TypePicker'
import { C, F, RADIUS, ROW_PAD } from '../lib/tokens'
import {
  updateTransaction,
  deleteTransaction,
  confirmAllPending,
  rejectAllPending,
  type ReviewData,
} from '../lib/api'
import { getReviewData } from '../lib/data'
import { invalidateTransactionData, queryKeys } from '../lib/query'
import { PREDEFINED_CATEGORIES, categoryColor } from '@paisa-buddy/shared/categories'
import {
  sanitizeAmountInput,
  parseAmountToPaise,
  formatDisplayAmount,
  formatAmount,
} from '@paisa-buddy/shared/logic/amount'
import {
  txToFormState,
  formStateToPayload,
  isTransactionConfirmable,
  type ReviewFormState,
} from '@paisa-buddy/shared/logic/review'
import { groupTransactionsByMonth } from '@paisa-buddy/shared/logic/transaction'
import { formatMonthLabel, formatDateLabel } from '@paisa-buddy/shared/logic/date'
import type { Transaction, TransactionType } from '@paisa-buddy/shared/types/transaction'
import type { Account } from '@paisa-buddy/shared/types/account'
import type { RootStackParamList } from '../navigation'

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Review'>
}

const TYPE_COLOR: Record<TransactionType, string> = {
  credit: C.pos,
  debit: C.neg,
  transfer: C.transfer,
}
const TYPE_PREFIX: Record<TransactionType, string> = { credit: '+', debit: '−', transfer: '⇄' }
const TYPES: Array<{ value: TransactionType; label: string; color: string }> = [
  { value: 'debit', label: 'Debit', color: C.neg },
  { value: 'credit', label: 'Credit', color: C.pos },
  { value: 'transfer', label: 'Transfer', color: C.transfer },
]

function ChevronDown() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="6 9 12 15 18 9" />
    </Svg>
  )
}

function CheckMark({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="20 6 9 17 4 12" />
    </Svg>
  )
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatTimeLabel(time: string): string {
  const date = timeToDate(time)
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()
}

function timeToDate(time: string): Date {
  const date = new Date()
  const [hours, minutes] = time.split(':').map(Number)
  if (Number.isFinite(hours)) date.setHours(hours)
  if (Number.isFinite(minutes)) date.setMinutes(minutes)
  date.setSeconds(0, 0)
  return date
}

export function ReviewScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const reviewQuery = useQuery({
    queryKey: queryKeys.review,
    queryFn: getReviewData,
  })

  const transactions = reviewQuery.data?.transactions ?? []
  const accounts = reviewQuery.data?.accounts ?? []
  const catColors = reviewQuery.data?.categoryColors ?? {}

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [activeTx, setActiveTx] = useState<Transaction | null>(null)
  const [form, setForm] = useState<ReviewFormState | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pendingDate, setPendingDate] = useState(new Date())
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [pendingTime, setPendingTime] = useState(new Date())

  // Picker sheets
  const [catPickerOpen, setCatPickerOpen] = useState(false)
  const [accPickerOpen, setAccPickerOpen] = useState(false)
  const [toAccPickerOpen, setToAccPickerOpen] = useState(false)

  // Bulk action state
  const [bulkLoading, setBulkLoading] = useState(false)

  const allCategories = [...new Set([...PREDEFINED_CATEGORIES, ...Object.keys(catColors)])]
  const grouped = groupTransactionsByMonth(transactions)

  const recentCategories = [...new Set(
    [...transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t) => t.category)
      .filter((c): c is string => !!c)
  )].slice(0, 3)
  const recentCats = recentCategories.filter((c) => allCategories.includes(c))
  const restCats = allCategories.filter((c) => !recentCats.includes(c))

  function openSheet(tx: Transaction) {
    setActiveTx(tx)
    setForm(txToFormState(tx))
    setShowDatePicker(false)
    setShowTimePicker(false)
    setSheetOpen(true)
  }

  function removeTx(id: string) {
    queryClient.setQueryData<ReviewData>(queryKeys.review, (prev) => (
      prev ? { ...prev, transactions: prev.transactions.filter((t) => t.id !== id) } : prev
    ))
    invalidateTransactionData(queryClient)
  }

  async function handleConfirm() {
    if (!activeTx || !form) return
    if (!isTransactionConfirmable(form)) {
      Alert.alert('Required', 'Category, account, and notes are required to confirm.')
      return
    }
    setConfirming(true)
    try {
      await updateTransaction(activeTx.id, { ...formStateToPayload(form), reviewed: true })
      removeTx(activeTx.id)
      setSheetOpen(false)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to confirm.')
    } finally {
      setConfirming(false)
    }
  }

  async function handleReject() {
    Alert.alert(
      'Reject transaction',
      'This will permanently delete the transaction.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setRejecting(true)
            try {
              await deleteTransaction(activeTx!.id)
              removeTx(activeTx!.id)
              setSheetOpen(false)
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to reject.')
              setRejecting(false)
            }
          },
        },
      ],
    )
  }

  async function handleBulkConfirm() {
    Alert.alert(
      `Confirm all ${transactions.length} transactions?`,
      'All pending transactions will be confirmed with their current values.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm all',
          onPress: async () => {
            setBulkLoading(true)
            try {
              await confirmAllPending()
              queryClient.setQueryData<ReviewData>(queryKeys.review, (prev) => (
                prev ? { ...prev, transactions: [] } : prev
              ))
              invalidateTransactionData(queryClient)
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed.')
            } finally {
              setBulkLoading(false)
            }
          },
        },
      ],
    )
  }

  async function handleBulkReject() {
    Alert.alert(
      `Reject all ${transactions.length} transactions?`,
      'All pending transactions will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject all',
          style: 'destructive',
          onPress: async () => {
            setBulkLoading(true)
            try {
              await rejectAllPending()
              queryClient.setQueryData<ReviewData>(queryKeys.review, (prev) => (
                prev ? { ...prev, transactions: [] } : prev
              ))
              invalidateTransactionData(queryClient)
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed.')
            } finally {
              setBulkLoading(false)
            }
          },
        },
      ],
    )
  }

  // ─── render ───────────────────────────────────────────────────────────────

  const activeType = form ? TYPES.find((t) => t.value === form.type)! : TYPES[0]
  const toAccounts = form ? accounts.filter((a) => a.id !== form.accountId) : []
  const canConfirm = form ? isTransactionConfirmable(form) : false
  const formDate = form ? new Date(form.date + 'T00:00:00') : new Date()
  const selectedAccountName = form ? accounts.find((a) => a.id === form.accountId)?.name : undefined
  const selectedToAccountName = form ? toAccounts.find((a) => a.id === form.toAccountId)?.name : undefined

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* ── Screen header ── */}
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <Polyline points="15 18 9 12 15 6" />
          </Svg>
        </Pressable>

        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Review</Text>
          {transactions.length > 0 && (
            <View style={s.countBadge}>
              <Text style={s.countBadgeText}>{transactions.length}</Text>
            </View>
          )}
        </View>

        {transactions.length > 0 && (
          <View style={s.bulkBtns}>
            <Pressable onPress={handleBulkReject} disabled={bulkLoading}>
              <Text style={[s.bulkReject, bulkLoading && s.btnDisabled]}>Reject all</Text>
            </Pressable>
            <Pressable
              onPress={handleBulkConfirm}
              disabled={bulkLoading}
              style={[s.bulkConfirmBtn, bulkLoading && s.btnDisabled]}
            >
              {bulkLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.bulkConfirmText}>Confirm all</Text>
              }
            </Pressable>
          </View>
        )}
      </View>

      {/* ── Body ── */}
      {reviewQuery.isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.brand} />
        </View>
      ) : transactions.length === 0 ? (
        <View style={s.center}>
          <View style={s.checkCircle}>
            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <Polyline points="20 6 9 17 4 12" />
            </Svg>
          </View>
          <Text style={s.emptyTitle}>All caught up!</Text>
          <Text style={s.emptySub}>No transactions to review right now.</Text>
        </View>
      ) : (
        <ScrollView
          style={s.list}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.hint}>Tap any transaction to review and edit details</Text>

          {grouped.map(({ month, txs }) => (
            <View key={month} style={s.group}>
              <View style={s.monthRow}>
                <Text style={s.monthLabel}>{formatMonthLabel(month)}</Text>
                <View style={s.monthCount}>
                  <Text style={s.monthCountText}>{txs.length}</Text>
                </View>
              </View>

              <View style={s.groupCard}>
                {txs.map((tx, i) => {
                  const tColor = TYPE_COLOR[tx.type]
                  const accountName = accounts.find((a) => a.id === tx.account_id)?.name
                  return (
                    <Pressable
                      key={tx.id}
                      style={[s.row, i > 0 && s.rowBorder]}
                      onPress={() => openSheet(tx)}
                    >
                      <View style={s.rowBody}>
                        <View style={s.rowTop}>
                          <Text style={s.rowMerchant} numberOfLines={1}>
                            {tx.merchant || tx.description || '—'}
                          </Text>
                        </View>
                        <View style={s.rowMeta}>
                          {tx.category && (
                            <Text style={s.rowCat}>{tx.category}</Text>
                          )}
                        </View>
                        <Text style={s.rowDate}>
                          {formatDateLabel(tx.date)}{accountName ? ` · ${accountName}` : ''}
                        </Text>
                      </View>
                      <View style={[s.typeBadge, { backgroundColor: tColor + '20' }]}>
                        <Text style={[s.typeBadgeText, { color: tColor }]}>{tx.type}</Text>
                      </View>
                      <Text style={[s.rowAmount, { color: tColor }]}>
                        {TYPE_PREFIX[tx.type]}{formatAmount(tx.amount)}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Review Sheet ── */}
      {form && (
        <Sheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          heightFraction={0.88}
          header={(
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Edit & Confirm</Text>
              <Pressable onPress={() => setSheetOpen(false)} style={s.sheetCancelBtn} hitSlop={8}>
                <Text style={s.sheetCancelText}>Cancel</Text>
              </Pressable>
            </View>
          )}
        >
          <ScrollView
            style={s.sheetScroll}
            contentContainerStyle={s.sheetContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Type selector */}
            <TypePicker types={TYPES} active={form.type} onChange={(v) => setForm({ ...form, type: v })} />

            {/* Amount */}
            <View style={s.amountRow}>
              <Text style={[s.rupeeSign, { color: activeType.color }]}>₹</Text>
              <TextInput
                style={[s.amountInput, { color: activeType.color }]}
                value={formatDisplayAmount(form.amountStr)}
                onChangeText={(v) => setForm({ ...form, amountStr: sanitizeAmountInput(v.replace(/,/g, '')) })}
                placeholder="0"
                placeholderTextColor={activeType.color + '60'}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            </View>

            {/* Merchant / Sender */}
            {form.type !== 'transfer' && (
              <View style={s.field}>
                <Text style={s.label}>
                  {form.type === 'credit' ? 'SENDER' : 'RECIPIENT'}
                </Text>
                <TextInput
                  style={s.textInput}
                  value={form.merchant}
                  onChangeText={(v) => setForm({ ...form, merchant: v })}
                  placeholder="Who was this with?"
                  placeholderTextColor={C.ink3}
                  returnKeyType="next"
                />
              </View>
            )}

            {/* Notes */}
            <View style={s.field}>
              <Text style={s.label}>NOTES <Text style={{ color: C.neg }}>*</Text></Text>
              <TextInput
                style={s.textInput}
                value={form.description}
                onChangeText={(v) => setForm({ ...form, description: v })}
                placeholder="What was this for?"
                placeholderTextColor={C.ink3}
                returnKeyType="next"
              />
            </View>

            {/* Category */}
            <View style={s.field}>
              <Text style={s.label}>CATEGORY <Text style={{ color: C.neg }}>*</Text></Text>
              <Pressable style={s.selectField} onPress={() => setCatPickerOpen(true)}>
                <View style={s.selectInner}>
                  {!!form.category && (
                    <View style={[s.catDot, { backgroundColor: categoryColor(form.category, catColors) }]} />
                  )}
                  <Text style={[s.selectText, !form.category && s.selectPlaceholder]} numberOfLines={1}>
                    {form.category || 'Select category'}
                  </Text>
                </View>
                <ChevronDown />
              </Pressable>
            </View>

            {/* Account */}
            <View style={s.field}>
              <Text style={s.label}>
                {form.type === 'transfer' ? 'FROM ACCOUNT' : 'ACCOUNT'} <Text style={{ color: C.neg }}>*</Text>
              </Text>
              <Pressable style={s.selectField} onPress={() => setAccPickerOpen(true)}>
                <Text style={[s.selectText, !form.accountId && s.selectPlaceholder]} numberOfLines={1}>
                  {selectedAccountName || 'Select account'}
                </Text>
                <ChevronDown />
              </Pressable>
            </View>

            {/* To Account (transfer only) */}
            {form.type === 'transfer' && (
              <View style={s.field}>
                <Text style={s.label}>TO ACCOUNT <Text style={{ color: C.neg }}>*</Text></Text>
                <Pressable style={s.selectField} onPress={() => setToAccPickerOpen(true)}>
                  <Text style={[s.selectText, !form.toAccountId && s.selectPlaceholder]} numberOfLines={1}>
                    {selectedToAccountName || 'Select account'}
                  </Text>
                  <ChevronDown />
                </Pressable>
              </View>
            )}

            {/* Date + Time */}
            <View style={s.twoCol}>
              <View style={s.colField}>
                <Text style={s.label}>DATE</Text>
                <Pressable
                  style={s.textInput}
                  onPress={() => {
                    if (Platform.OS === 'android') {
                      DateTimePickerAndroid.open({
                        value: formDate,
                        mode: 'date',
                        maximumDate: new Date(),
                        onChange: (_, selected) => {
                          if (selected && form) setForm({ ...form, date: selected.toISOString().slice(0, 10) })
                        },
                      })
                    } else {
                      setPendingDate(formDate)
                      setShowDatePicker(true)
                    }
                  }}
                >
                  <Text style={s.dateText}>
                    {formDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </Pressable>
              </View>
              <View style={s.colField}>
                <Text style={s.label}>TIME</Text>
                <Pressable
                  style={s.textInput}
                  onPress={() => {
                    const value = form.time ? timeToDate(form.time) : new Date()
                    if (Platform.OS === 'android') {
                      DateTimePickerAndroid.open({
                        value,
                        mode: 'time',
                        is24Hour: false,
                        onChange: (_, selected) => {
                          if (selected && form) setForm({ ...form, time: formatTime(selected) })
                        },
                      })
                    } else {
                      setPendingTime(value)
                      setShowTimePicker(true)
                    }
                  }}
                >
                  <Text style={[s.dateText, !form.time && s.selectPlaceholder]}>{form.time ? formatTimeLabel(form.time) : 'Not set'}</Text>
                </Pressable>
              </View>
            </View>

            {/* Action buttons */}
            <View style={s.actionRow}>
              <Pressable
                style={[s.rejectBtn, rejecting && s.btnDisabled]}
                onPress={handleReject}
                disabled={rejecting || confirming}
              >
                {rejecting
                  ? <ActivityIndicator size="small" color={C.neg} />
                  : <Text style={s.rejectBtnText}>Reject</Text>
                }
              </Pressable>
              <Pressable
                style={[s.confirmBtn, (!canConfirm || confirming) && s.btnDisabled]}
                onPress={handleConfirm}
                disabled={!canConfirm || confirming || rejecting}
              >
                {confirming
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.confirmBtnText}>Confirm →</Text>
                }
              </Pressable>
            </View>
          </ScrollView>

          {/* ── Category picker sheet ── */}
          <Sheet
            visible={catPickerOpen}
            onClose={() => setCatPickerOpen(false)}
            heightFraction={0.6}
            header={(
              <View style={s.pickerHeader}>
                <Text style={s.pickerTitle}>Category</Text>
                <Pressable onPress={() => setCatPickerOpen(false)} hitSlop={8}>
                  <Text style={s.pickerDone}>Done</Text>
                </Pressable>
              </View>
            )}
          >
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.pickerScroll}>
              {recentCats.length > 0 && (
                <>
                  <Text style={s.pickerSectionLabel}>RECENT</Text>
                  {recentCats.map((cat) => (
                    <Pressable
                      key={`recent-${cat}`}
                      style={s.pickerRow}
                      onPress={() => { setForm({ ...form, category: cat }); setCatPickerOpen(false) }}
                    >
                      <View style={[s.catDot, { backgroundColor: categoryColor(cat, catColors) }]} />
                      <Text style={[s.pickerRowText, form.category === cat && { color: activeType.color, fontFamily: F.semibold }]}>
                        {cat}
                      </Text>
                      {form.category === cat && <CheckMark color={activeType.color} />}
                    </Pressable>
                  ))}
                </>
              )}
              <Text style={s.pickerSectionLabel}>{recentCats.length > 0 ? 'ALL' : 'CATEGORIES'}</Text>
              {restCats.map((cat) => (
                <Pressable
                  key={cat}
                  style={s.pickerRow}
                  onPress={() => { setForm({ ...form, category: cat }); setCatPickerOpen(false) }}
                >
                  <View style={[s.catDot, { backgroundColor: categoryColor(cat, catColors) }]} />
                  <Text style={[s.pickerRowText, form.category === cat && { color: activeType.color, fontFamily: F.semibold }]}>
                    {cat}
                  </Text>
                  {form.category === cat && <CheckMark color={activeType.color} />}
                </Pressable>
              ))}
            </ScrollView>
          </Sheet>

          {/* ── Account picker sheet ── */}
          <Sheet
            visible={accPickerOpen}
            onClose={() => setAccPickerOpen(false)}
            heightFraction={0.5}
            header={(
              <View style={s.pickerHeader}>
                <Text style={s.pickerTitle}>{form.type === 'transfer' ? 'From Account' : 'Account'}</Text>
                <Pressable onPress={() => setAccPickerOpen(false)} hitSlop={8}>
                  <Text style={s.pickerDone}>Done</Text>
                </Pressable>
              </View>
            )}
          >
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.pickerScroll}>
              {accounts.length === 0 && (
                <Text style={s.pickerEmptyText}>No accounts yet</Text>
              )}
              {accounts.map((acc) => (
                <Pressable
                  key={acc.id}
                  style={s.pickerRow}
                  onPress={() => { setForm({ ...form, accountId: acc.id }); setAccPickerOpen(false) }}
                >
                  <Text style={[s.pickerRowText, form.accountId === acc.id && { color: activeType.color, fontFamily: F.semibold }]}>
                    {acc.name}
                  </Text>
                  {form.accountId === acc.id && <CheckMark color={activeType.color} />}
                </Pressable>
              ))}
            </ScrollView>
          </Sheet>

          {/* ── To Account picker sheet ── */}
          <Sheet
            visible={toAccPickerOpen}
            onClose={() => setToAccPickerOpen(false)}
            heightFraction={0.5}
            header={(
              <View style={s.pickerHeader}>
                <Text style={s.pickerTitle}>To Account</Text>
                <Pressable onPress={() => setToAccPickerOpen(false)} hitSlop={8}>
                  <Text style={s.pickerDone}>Done</Text>
                </Pressable>
              </View>
            )}
          >
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.pickerScroll}>
              {toAccounts.map((acc) => (
                <Pressable
                  key={acc.id}
                  style={s.pickerRow}
                  onPress={() => {
                    setForm({ ...form, toAccountId: acc.id, merchant: acc.name })
                    setToAccPickerOpen(false)
                  }}
                >
                  <Text style={[s.pickerRowText, form.toAccountId === acc.id && { color: activeType.color, fontFamily: F.semibold }]}>
                    {acc.name}
                  </Text>
                  {form.toAccountId === acc.id && <CheckMark color={activeType.color} />}
                </Pressable>
              ))}
            </ScrollView>
          </Sheet>

          {/* iOS date picker modal */}
          {Platform.OS === 'ios' && (
            <Modal visible={showDatePicker} transparent animationType="fade">
              <Pressable style={s.modalOverlay} onPress={() => setShowDatePicker(false)}>
                <View style={s.modalCard}>
                  <View style={s.pickerWrapper}>
                    <DateTimePicker
                      value={pendingDate}
                      mode="date"
                      display="spinner"
                      onChange={(_, selected) => { if (selected) setPendingDate(selected) }}
                      maximumDate={new Date()}
                      textColor={C.ink}
                    />
                  </View>
                  <Pressable
                    style={s.modalDoneBtn}
                    onPress={() => {
                      const y = pendingDate.getFullYear()
                      const m = String(pendingDate.getMonth() + 1).padStart(2, '0')
                      const d = String(pendingDate.getDate()).padStart(2, '0')
                      setForm((prev) => prev ? { ...prev, date: `${y}-${m}-${d}` } : prev)
                      setShowDatePicker(false)
                    }}
                  >
                    <Text style={s.modalDoneText}>Done</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Modal>
          )}

          {/* iOS time picker modal */}
          {Platform.OS === 'ios' && (
            <Modal visible={showTimePicker} transparent animationType="fade">
              <Pressable style={s.modalOverlay} onPress={() => setShowTimePicker(false)}>
                <View style={s.modalCard}>
                  <View style={s.pickerWrapper}>
                    <DateTimePicker
                      value={pendingTime}
                      mode="time"
                      display="spinner"
                      is24Hour={false}
                      onChange={(_, selected) => { if (selected) setPendingTime(selected) }}
                      textColor={C.ink}
                    />
                  </View>
                  <Pressable
                    style={s.modalDoneBtn}
                    onPress={() => {
                      setForm((prev) => prev ? { ...prev, time: formatTime(pendingTime) } : prev)
                      setShowTimePicker(false)
                    }}
                  >
                    <Text style={s.modalDoneText}>Done</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Modal>
          )}
        </Sheet>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Screen header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.bg,
    gap: 8,
  },
  backBtn: { padding: 2 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 4 },
  headerTitle: { fontSize: 20, fontFamily: F.extrabold, color: C.ink },
  countBadge: {
    backgroundColor: C.neg,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: { fontSize: 11, fontFamily: F.extrabold, color: '#fff' },
  bulkBtns: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bulkReject: { fontSize: 12, fontFamily: F.bold, color: C.neg },
  bulkConfirmBtn: {
    backgroundColor: C.brand,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  bulkConfirmText: { fontSize: 12, fontFamily: F.bold, color: '#fff' },

  // Loading / empty
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontFamily: F.extrabold, color: C.ink },
  emptySub: { fontSize: 14, fontFamily: F.regular, color: C.ink3 },

  // List
  list: { flex: 1 },
  hint: { fontSize: 12, fontFamily: F.regular, color: C.ink3, marginHorizontal: 18, marginTop: 10, marginBottom: 4 },
  group: { marginHorizontal: 16, marginTop: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  monthLabel: { fontSize: 11, fontFamily: F.bold, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.6 },
  monthCount: {
    backgroundColor: C.neg + '18',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCountText: { fontSize: 11, fontFamily: F.semibold, color: C.neg },
  groupCard: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.line,
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: C.line },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowMerchant: { flex: 1, fontSize: 13.5, fontFamily: F.semibold, color: C.ink },
  typeBadge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeText: { fontSize: 9, fontFamily: F.extrabold, letterSpacing: 0.4, textTransform: 'uppercase' },
  rowMeta: { flexDirection: 'row', alignItems: 'center' },
  rowCat: { fontSize: 12, fontFamily: F.bold, color: C.ink3 },
  rowDate: { fontSize: 11, fontFamily: F.regular, color: C.ink3 },
  rowAmount: { fontSize: 15, fontFamily: F.monoBold, flexShrink: 0 },

  // Sheet header
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sheetTitle: { flex: 1, marginRight: 12, fontSize: 20, fontFamily: F.semibold, color: C.ink },
  sheetCancelBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  sheetCancelText: { fontSize: 14, fontFamily: F.regular, color: C.ink3 },
  sheetScroll: { flex: 1 },
  sheetContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 20 },

  // Amount
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  rupeeSign: { fontSize: 40, fontFamily: F.regular, lineHeight: 56 },
  amountInput: {
    fontSize: 52,
    fontFamily: F.semibold,
    textAlign: 'center',
    minWidth: 120,
    padding: 0,
  },

  // Form fields
  field: { gap: 8 },
  twoCol: { flexDirection: 'row', gap: 16 },
  colField: { flex: 1, gap: 8 },
  label: { fontSize: 11, fontFamily: F.medium, color: C.ink3, letterSpacing: 0.4 },
  textInput: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
    fontSize: 14,
    fontFamily: F.regular,
    color: C.ink,
  },
  dateText: { fontSize: 14, fontFamily: F.regular, color: C.ink },

  // Date picker modal (iOS)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    overflow: 'hidden',
  },
  pickerWrapper: { alignItems: 'center', backgroundColor: C.surface },
  modalDoneBtn: {
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: C.brand,
  },
  modalDoneText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },

  // Select field
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
  },
  selectInner: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  selectText: { flex: 1, fontSize: 14, fontFamily: F.regular, color: C.ink },
  selectPlaceholder: { color: C.ink3 },
  catDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },

  // Picker sheet
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  pickerTitle: { fontSize: 16, fontFamily: F.semibold, color: C.ink },
  pickerDone: { fontSize: 14, fontFamily: F.semibold, color: C.brand },
  pickerSectionLabel: {
    fontSize: 11,
    fontFamily: F.medium,
    color: C.ink3,
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  pickerRowText: { flex: 1, fontSize: 14, fontFamily: F.regular, color: C.ink },
  pickerScroll: { paddingBottom: 32 },
  pickerEmptyText: {
    fontSize: 14,
    fontFamily: F.regular,
    color: C.ink3,
    paddingHorizontal: 16,
    paddingVertical: 20,
    textAlign: 'center',
  },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  rejectBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: RADIUS,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.neg,
  },
  rejectBtnText: { fontSize: 15, fontFamily: F.semibold, color: C.neg },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS,
    alignItems: 'center',
    backgroundColor: C.brand,
  },
  confirmBtnText: { fontSize: 15, fontFamily: F.semibold, color: '#fff' },
  btnDisabled: { opacity: 0.4 },
})
