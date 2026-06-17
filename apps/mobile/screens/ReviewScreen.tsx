import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Svg, { Circle, Polyline, Line, Path } from 'react-native-svg'
import { Sheet } from '../components/Sheet'
import { TypePicker } from '../components/TypePicker'
import { C, F, RADIUS, ROW_PAD } from '../lib/tokens'
import {
  fetchReviewData,
  updateTransaction,
  deleteTransaction,
  createAccount,
  createCategory,
  confirmAllPending,
  rejectAllPending,
} from '../lib/api'
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
import type { Account, AccountType } from '@paisa-buddy/shared/types/account'
import { ACCOUNT_TYPE_LABELS } from '@paisa-buddy/shared/types/account'
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
const ACCOUNT_TYPES: AccountType[] = ['savings', 'current', 'credit', 'wallet', 'other']

export function ReviewScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [catColors, setCatColors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [activeTx, setActiveTx] = useState<Transaction | null>(null)
  const [form, setForm] = useState<ReviewFormState | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  // Inline add forms in sheet
  const [extraAccounts, setExtraAccounts] = useState<Account[]>([])
  const [extraCatColors, setExtraCatColors] = useState<Record<string, string>>({})
  const [addingAccount, setAddingAccount] = useState(false)
  const [newAccName, setNewAccName] = useState('')
  const [newAccType, setNewAccType] = useState<AccountType>('savings')
  const [addingAccSaving, setAddingAccSaving] = useState(false)
  const [addingCat, setAddingCat] = useState(false)
  const [newCatInput, setNewCatInput] = useState('')
  const [addingCatSaving, setAddingCatSaving] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Bulk action state
  const [bulkLoading, setBulkLoading] = useState(false)

  const allAccounts = [...accounts, ...extraAccounts.filter((a) => !accounts.find((x) => x.id === a.id))]
  const allCatColors = { ...catColors, ...extraCatColors }
  const allCategories = [...new Set([...PREDEFINED_CATEGORIES, ...Object.keys(allCatColors)])]
  const grouped = groupTransactionsByMonth(transactions)

  async function load(quiet = false) {
    if (!quiet) setLoading(true)
    try {
      const data = await fetchReviewData()
      setTransactions(data.transactions)
      setAccounts(data.accounts)
      setCatColors(data.categoryColors)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(useCallback(() => { load() }, []))

  function openSheet(tx: Transaction) {
    setActiveTx(tx)
    setForm(txToFormState(tx))
    setExtraAccounts([])
    setExtraCatColors({})
    setAddingAccount(false)
    setAddingCat(false)
    setNewAccName('')
    setNewCatInput('')
    setShowDatePicker(false)
    setSheetOpen(true)
  }

  function removeTx(id: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== id))
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

  async function handleAddAccount() {
    const name = newAccName.trim()
    if (!name) return
    setAddingAccSaving(true)
    try {
      const acc = await createAccount(name, newAccType)
      setExtraAccounts((prev) => [...prev, acc])
      if (form) setForm({ ...form, accountId: acc.id })
      setAddingAccount(false)
      setNewAccName('')
      setNewAccType('savings')
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create account.')
    } finally {
      setAddingAccSaving(false)
    }
  }

  async function handleAddCategory() {
    const name = newCatInput.trim()
    if (!name) return
    setAddingCatSaving(true)
    try {
      const result = await createCategory(name)
      setExtraCatColors((prev) => ({ ...prev, [result.name]: result.color }))
      if (form) setForm({ ...form, category: result.name })
      setAddingCat(false)
      setNewCatInput('')
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create category.')
    } finally {
      setAddingCatSaving(false)
    }
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
              setTransactions([])
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
              setTransactions([])
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
  const toAccounts = form ? allAccounts.filter((a) => a.id !== form.accountId) : []
  const canConfirm = form ? isTransactionConfirmable(form) : false
  const formDate = form ? new Date(form.date + 'T00:00:00') : new Date()

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
              <Text style={[s.bulkReject, bulkLoading && s.disabled]}>Reject all</Text>
            </Pressable>
            <Pressable
              onPress={handleBulkConfirm}
              disabled={bulkLoading}
              style={[s.bulkConfirmBtn, bulkLoading && s.disabled]}
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
      {loading ? (
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true) }} tintColor={C.brand} />
          }
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
                  const accountName = allAccounts.find((a) => a.id === tx.account_id)?.name
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
        <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} heightFraction={0.92}>
          {/* Header */}
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>Edit & Confirm</Text>
            <Pressable onPress={() => setSheetOpen(false)} style={s.sheetCancelBtn} hitSlop={8}>
              <Text style={s.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>

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

            {/* Merchant */}
            <View style={s.field}>
              <Text style={s.label}>
                {form.type === 'credit' ? 'SENDER' : form.type === 'transfer' ? 'ACCOUNT' : 'RECIPIENT'}
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
              <View style={s.chips}>
                {allCategories.map((cat) => {
                  const active = form.category === cat
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setForm({ ...form, category: active ? '' : cat })}
                      style={[s.chip, active && { backgroundColor: activeType.color, borderColor: activeType.color }]}
                    >
                      <Text style={[s.chipText, active && s.chipTextActive]}>{cat}</Text>
                    </Pressable>
                  )
                })}
                {addingCat ? (
                  <View style={s.inlineInputRow}>
                    <TextInput
                      style={s.inlineInput}
                      autoFocus
                      placeholder="Category name"
                      placeholderTextColor={C.ink3}
                      value={newCatInput}
                      onChangeText={setNewCatInput}
                      returnKeyType="done"
                      onSubmitEditing={handleAddCategory}
                    />
                    <Pressable
                      style={s.inlineConfirm}
                      onPress={handleAddCategory}
                      disabled={!newCatInput.trim() || addingCatSaving}
                    >
                      {addingCatSaving
                        ? <ActivityIndicator size="small" color={C.brand} />
                        : <Text style={s.inlineConfirmText}>✓</Text>
                      }
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={s.chipDashed} onPress={() => setAddingCat(true)}>
                    <Text style={s.chipDashedText}>+ Custom</Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* Account */}
            <View style={s.field}>
              <Text style={s.label}>ACCOUNT <Text style={{ color: C.neg }}>*</Text></Text>
              {allAccounts.length > 0 && (
                <View style={s.chips}>
                  {allAccounts.map((acc) => {
                    const active = form.accountId === acc.id
                    return (
                      <Pressable
                        key={acc.id}
                        onPress={() => setForm({ ...form, accountId: active ? '' : acc.id })}
                        style={[s.chip, active && { backgroundColor: activeType.color, borderColor: activeType.color }]}
                      >
                        <Text style={[s.chipText, active && s.chipTextActive]}>{acc.name}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              )}
              {addingAccount ? (
                <View style={s.addAccountForm}>
                  <TextInput
                    style={s.textInput}
                    autoFocus
                    placeholder="Account name"
                    placeholderTextColor={C.ink3}
                    value={newAccName}
                    onChangeText={setNewAccName}
                    returnKeyType="done"
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    <View style={[s.chips, { flexWrap: 'nowrap' }]}>
                      {ACCOUNT_TYPES.map((t) => {
                        const active = newAccType === t
                        return (
                          <Pressable
                            key={t}
                            onPress={() => setNewAccType(t)}
                            style={[s.chip, s.chipSm, active && { backgroundColor: C.brand, borderColor: C.brand }]}
                          >
                            <Text style={[s.chipSmText, active && s.chipTextActive]}>
                              {ACCOUNT_TYPE_LABELS[t]}
                            </Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  </ScrollView>
                  <View style={s.addFormActions}>
                    <Pressable style={s.cancelBtn} onPress={() => { setAddingAccount(false); setNewAccName('') }}>
                      <Text style={s.cancelBtnText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[s.addBtn, (!newAccName.trim() || addingAccSaving) && s.btnDisabled]}
                      onPress={handleAddAccount}
                      disabled={!newAccName.trim() || addingAccSaving}
                    >
                      {addingAccSaving
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={s.addBtnText}>Add</Text>
                      }
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable style={s.chipDashed} onPress={() => setAddingAccount(true)}>
                  <Text style={s.chipDashedText}>+ Add account</Text>
                </Pressable>
              )}
            </View>

            {/* To Account (transfer only) */}
            {form.type === 'transfer' && (
              <View style={s.field}>
                <Text style={s.label}>TO ACCOUNT <Text style={{ color: C.neg }}>*</Text></Text>
                <View style={s.chips}>
                  {toAccounts.map((acc) => {
                    const active = form.toAccountId === acc.id
                    return (
                      <Pressable
                        key={acc.id}
                        onPress={() => setForm({ ...form, toAccountId: active ? '' : acc.id })}
                        style={[s.chip, active && { backgroundColor: activeType.color, borderColor: activeType.color }]}
                      >
                        <Text style={[s.chipText, active && s.chipTextActive]}>{acc.name}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            )}

            {/* Date */}
            <View style={s.field}>
              <Text style={s.label}>DATE</Text>
              <Pressable
                style={s.datePressable}
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
                    setShowDatePicker(true)
                  }
                }}
              >
                <Text style={s.dateText}>
                  {formDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </Pressable>
              {showDatePicker && Platform.OS === 'ios' && (
                <DateTimePicker
                  value={formDate}
                  mode="date"
                  display="inline"
                  onChange={(_, selected) => {
                    if (selected && form) setForm({ ...form, date: selected.toISOString().slice(0, 10) })
                  }}
                  maximumDate={new Date()}
                />
              )}
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
  disabled: { opacity: 0.4 },

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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
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
  sheetTitle: { fontSize: 16, fontFamily: F.semibold, color: C.ink },
  sheetCancelBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  sheetCancelText: { fontSize: 15, fontFamily: F.regular, color: C.brand },
  sheetScroll: { flex: 1 },
  sheetContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40, gap: 20 },


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
  datePressable: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
  },
  dateText: { fontSize: 14, fontFamily: F.regular, color: C.ink },

  // Chips
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
  },
  chipSm: { paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 13.5, fontFamily: F.regular, color: C.ink },
  chipSmText: { fontSize: 12, fontFamily: F.regular, color: C.ink },
  chipTextActive: { color: '#fff', fontFamily: F.medium },
  chipDashed: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.line,
    backgroundColor: C.bg,
  },
  chipDashedText: { fontSize: 13.5, fontFamily: F.regular, color: C.ink3 },

  // Inline input row (for adding category inline)
  inlineInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inlineInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
    fontSize: 13.5,
    fontFamily: F.regular,
    color: C.ink,
    minWidth: 120,
  },
  inlineConfirm: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineConfirmText: { fontSize: 14, fontFamily: F.semibold, color: C.ink },

  // Add account form
  addAccountForm: {
    backgroundColor: C.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    padding: 12,
    gap: 4,
  },
  addFormActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.line,
  },
  cancelBtnText: { fontSize: 13, fontFamily: F.regular, color: C.ink3 },
  addBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: C.brand,
  },
  addBtnText: { fontSize: 13, fontFamily: F.semibold, color: '#fff' },
  btnDisabled: { opacity: 0.4 },

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
})
