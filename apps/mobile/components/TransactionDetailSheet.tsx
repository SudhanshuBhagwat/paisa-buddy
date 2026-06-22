import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import Svg, { Polyline } from 'react-native-svg'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { useQueryClient } from '@tanstack/react-query'
import { Sheet } from './Sheet'
import { Dialog, MessageDialog, type MessageDialogState } from './Dialog'
import { TypePicker } from './TypePicker'
import { C, F, RADIUS } from '../lib/tokens'
import { updateTransaction } from '../repositories/transactionRepository'
import { invalidateTransactionData } from '../lib/query'
import { PREDEFINED_CATEGORIES, categoryColor } from '@paisa-buddy/shared/categories'
import {
  sanitizeAmountInput,
  parseAmountToPaise,
  formatDisplayAmount,
} from '@paisa-buddy/shared/logic/amount'
import {
  txToFormState,
  formStateToPayload,
} from '@paisa-buddy/shared/logic/review'
import type { Transaction, TransactionType } from '@paisa-buddy/shared/types/transaction'
import type { Account } from '@paisa-buddy/shared/types/account'

type Props = {
  tx: Transaction | null
  visible: boolean
  onClose: () => void
  onSaved: (tx: Transaction) => void
  onDelete?: (tx: Transaction) => Promise<void>
  accounts: Account[]
  catColors: Record<string, string>
  recentCategories?: string[]
}

const TYPES: Array<{ value: TransactionType; label: string; color: string }> = [
  { value: 'credit', label: 'Credit', color: C.pos },
  { value: 'debit', label: 'Debit', color: C.neg },
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

export function TransactionDetailSheet({
  tx,
  visible,
  onClose,
  onSaved,
  onDelete,
  accounts,
  catColors,
  recentCategories = [],
}: Props) {
  const queryClient = useQueryClient()
  const [type, setType] = useState<TransactionType>('debit')
  const [amountStr, setAmountStr] = useState('')
  const [date, setDateStr] = useState('')
  const [time, setTime] = useState('')
  const [merchant, setMerchant] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [accountId, setAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [bank, setBank] = useState('')
  const [upiRef, setUpiRef] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)

  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pendingDate, setPendingDate] = useState(new Date())
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [pendingTime, setPendingTime] = useState(new Date())
  const [saving, setSaving] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [messageDialog, setMessageDialog] = useState<MessageDialogState | null>(null)

  const [catPickerOpen, setCatPickerOpen] = useState(false)
  const [accPickerOpen, setAccPickerOpen] = useState(false)
  const [toAccPickerOpen, setToAccPickerOpen] = useState(false)

  const allCategories = [...new Set([...PREDEFINED_CATEGORIES, ...Object.keys(catColors)])]
  const toAccounts = accounts.filter((a) => a.id !== accountId)

  const recentCats = recentCategories.filter((c) => allCategories.includes(c)).slice(0, 3)
  const restCats = allCategories.filter((c) => !recentCats.includes(c))

  const selectedAccountName = accounts.find((a) => a.id === accountId)?.name
  const selectedToAccountName = toAccounts.find((a) => a.id === toAccountId)?.name

  useEffect(() => {
    if (visible && tx) {
      const f = txToFormState(tx)
      setType(f.type)
      setAmountStr(f.amountStr)
      setDateStr(f.date)
      setTime(f.time)
      setMerchant(f.merchant)
      setDescription(f.description)
      setCategory(f.category)
      setAccountId(f.accountId)
      setToAccountId(f.toAccountId)
      setBank(f.bank)
      setUpiRef(f.upiRef)
      setIsRecurring(f.isRecurring)
      setShowDatePicker(false)
      setShowTimePicker(false)
      setDeleteConfirmOpen(false)
      setDeleting(false)
    }
  }, [visible, tx?.id])

  const activeType = TYPES.find((t) => t.value === type)!
  const merchantLabel = type === 'credit' ? 'SENDER' : type === 'transfer' ? 'ACCOUNT' : 'RECIPIENT'
  const formDate = date ? new Date(date + 'T00:00:00') : new Date()

  const isValid =
    parseAmountToPaise(amountStr) > 0 &&
    !!description.trim() &&
    !!category &&
    !!accountId &&
    (type !== 'transfer' || !!toAccountId)

  async function handleConfirmDelete() {
    if (!tx || !onDelete) return
    setDeleting(true)
    try {
      await onDelete(tx)
    } catch {
      setMessageDialog({ title: 'Error', message: 'Could not delete transaction.' })
    } finally {
      setDeleting(false)
      setDeleteConfirmOpen(false)
    }
  }

  async function handleSave() {
    if (!tx || !isValid) return
    setSaving(true)
    try {
      const payload = formStateToPayload({ type, amountStr, date, time, merchant, description, category, accountId, toAccountId, bank, upiRef, isRecurring, investmentId: '' })
      const updated = await updateTransaction(tx.id, tx.reviewed ? payload : { ...payload, reviewed: true })
      invalidateTransactionData(queryClient)
      onSaved(updated)
      onClose()
    } catch (e) {
      setMessageDialog({ title: 'Error', message: e instanceof Error ? e.message : 'Failed to save.' })
    } finally {
      setSaving(false)
    }
  }

  if (!tx) return null

  return (
    <>
    <Sheet
      visible={visible}
      onClose={onClose}
      heightFraction={0.88}
      header={(
        <View style={s.header}>
          <Text style={s.headerTitle}>Edit Transaction</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={s.headerCancel}>Cancel</Text>
          </Pressable>
        </View>
      )}
    >
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Type selector */}
        <TypePicker types={TYPES} active={type} onChange={setType} />

        {/* Amount */}
        <View style={s.amountRow}>
          <Text style={[s.rupeeSign, { color: activeType.color }]}>₹</Text>
          <TextInput
            style={[s.amountInput, { color: activeType.color }]}
            value={formatDisplayAmount(amountStr)}
            onChangeText={(v) => setAmountStr(sanitizeAmountInput(v.replace(/,/g, '')))}
            placeholder="0"
            placeholderTextColor={activeType.color + '60'}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
          <Text style={[s.rupeeSign, { color: 'transparent' }]} aria-hidden>₹</Text>
        </View>

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
                    onChange: (_, selected) => { if (selected) setDateStr(selected.toISOString().slice(0, 10)) },
                  })
                } else {
                  setPendingDate(formDate)
                  setShowDatePicker(true)
                }
              }}
            >
              <Text style={s.inputText}>
                {date ? new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              </Text>
            </Pressable>
          </View>
          <View style={s.colField}>
            <Text style={s.label}>TIME</Text>
            <Pressable
              style={s.textInput}
              onPress={() => {
                const value = time ? timeToDate(time) : new Date()
                if (Platform.OS === 'android') {
                  DateTimePickerAndroid.open({
                    value,
                    mode: 'time',
                    is24Hour: false,
                    onChange: (_, selected) => { if (selected) setTime(formatTime(selected)) },
                  })
                } else {
                  setPendingTime(value)
                  setShowTimePicker(true)
                }
              }}
            >
              <Text style={[s.inputText, !time && s.selectPlaceholder]}>{time ? formatTimeLabel(time) : 'Not set'}</Text>
            </Pressable>
          </View>
        </View>

        {/* Merchant / Sender */}
        {type !== 'transfer' && (
          <View style={s.field}>
            <Text style={s.label}>{merchantLabel}</Text>
            <TextInput
              style={s.textInput}
              value={merchant}
              onChangeText={setMerchant}
              placeholder="e.g. Swiggy, Amazon"
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
            value={description}
            onChangeText={setDescription}
            placeholder="What was this for?"
            placeholderTextColor={C.ink3}
            returnKeyType="next"
          />
        </View>

        {/* Category */}
        <View style={s.field}>
          <Text style={s.label}>CATEGORY <Text style={{ color: C.neg }}>*</Text></Text>
          <Pressable
            style={s.selectField}
            onPress={() => setCatPickerOpen(true)}
          >
            <View style={s.selectInner}>
              {!!category && (
                <View style={[s.catDot, { backgroundColor: categoryColor(category, catColors) }]} />
              )}
              <Text style={[s.selectText, !category && s.selectPlaceholder]} numberOfLines={1}>
                {category || 'Select category'}
              </Text>
            </View>
            <ChevronDown />
          </Pressable>
        </View>

        {/* Account */}
        <View style={s.field}>
          <Text style={s.label}>{type === 'transfer' ? 'FROM ACCOUNT' : 'ACCOUNT'} <Text style={{ color: C.neg }}>*</Text></Text>
          <Pressable
            style={s.selectField}
            onPress={() => setAccPickerOpen(true)}
          >
            <Text style={[s.selectText, !accountId && s.selectPlaceholder]} numberOfLines={1}>
              {selectedAccountName || 'Select account'}
            </Text>
            <ChevronDown />
          </Pressable>
        </View>

        {/* To Account (transfer only) */}
        {type === 'transfer' && (
          <View style={s.field}>
            <Text style={s.label}>TO ACCOUNT <Text style={{ color: C.neg }}>*</Text></Text>
            <Pressable
              style={s.selectField}
              onPress={() => setToAccPickerOpen(true)}
            >
              <Text style={[s.selectText, !toAccountId && s.selectPlaceholder]} numberOfLines={1}>
                {selectedToAccountName || 'Select account'}
              </Text>
              <ChevronDown />
            </Pressable>
          </View>
        )}

        {/* Bank + UPI Ref */}
        <View style={s.twoCol}>
          <View style={s.colField}>
            <Text style={s.label}>BANK</Text>
            <TextInput
              style={s.textInput}
              value={bank}
              onChangeText={setBank}
              placeholder="e.g. HDFC"
              placeholderTextColor={C.ink3}
              returnKeyType="next"
            />
          </View>
          <View style={s.colField}>
            <Text style={s.label}>UPI REF</Text>
            <TextInput
              style={[s.textInput, { fontFamily: F.mono }]}
              value={upiRef}
              onChangeText={setUpiRef}
              placeholder="Ref no."
              placeholderTextColor={C.ink3}
              returnKeyType="done"
            />
          </View>
        </View>

        {/* Recurring toggle */}
        <View style={s.toggleRow}>
          <Text style={s.toggleLabel}>Recurring transaction</Text>
          <Switch
            value={isRecurring}
            onValueChange={setIsRecurring}
            trackColor={{ false: C.line, true: C.pos }}
            thumbColor={C.surface}
          />
        </View>

        {/* Save button */}
        <Pressable
          style={[s.saveBtn, { backgroundColor: activeType.color }, (!isValid || saving) && s.btnDisabled]}
          onPress={handleSave}
          disabled={!isValid || saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.saveBtnText}>Save</Text>
          }
        </Pressable>
        {onDelete ? (
          <Pressable
            style={s.deleteBtn}
            onPress={() => setDeleteConfirmOpen(true)}
          >
            <Text style={s.deleteBtnText}>Delete Transaction</Text>
          </Pressable>
        ) : null}
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
                  onPress={() => { setCategory(cat); setCatPickerOpen(false) }}
                >
                  <View style={[s.catDot, { backgroundColor: categoryColor(cat, catColors) }]} />
                  <Text style={[s.pickerRowText, category === cat && { color: activeType.color, fontFamily: F.semibold }]}>
                    {cat}
                  </Text>
                  {category === cat && <CheckMark color={activeType.color} />}
                </Pressable>
              ))}
            </>
          )}
          <Text style={s.pickerSectionLabel}>{recentCats.length > 0 ? 'ALL' : 'CATEGORIES'}</Text>
          {restCats.map((cat) => (
            <Pressable
              key={cat}
              style={s.pickerRow}
              onPress={() => { setCategory(cat); setCatPickerOpen(false) }}
            >
              <View style={[s.catDot, { backgroundColor: categoryColor(cat, catColors) }]} />
              <Text style={[s.pickerRowText, category === cat && { color: activeType.color, fontFamily: F.semibold }]}>
                {cat}
              </Text>
              {category === cat && <CheckMark color={activeType.color} />}
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
            <Text style={s.pickerTitle}>Account</Text>
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
              onPress={() => { setAccountId(acc.id); setAccPickerOpen(false) }}
            >
              <Text style={[s.pickerRowText, accountId === acc.id && { color: activeType.color, fontFamily: F.semibold }]}>
                {acc.name}
              </Text>
              {accountId === acc.id && <CheckMark color={activeType.color} />}
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
              onPress={() => { setToAccountId(acc.id); setToAccPickerOpen(false) }}
            >
              <Text style={[s.pickerRowText, toAccountId === acc.id && { color: activeType.color, fontFamily: F.semibold }]}>
                {acc.name}
              </Text>
              {toAccountId === acc.id && <CheckMark color={activeType.color} />}
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
                onPress={() => { setDateStr(pendingDate.toISOString().slice(0, 10)); setShowDatePicker(false) }}
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
                onPress={() => { setTime(formatTime(pendingTime)); setShowTimePicker(false) }}
              >
                <Text style={s.modalDoneText}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}

      {onDelete && (
        <Dialog
          visible={deleteConfirmOpen}
          onClose={() => { if (!deleting) setDeleteConfirmOpen(false) }}
          title="Delete transaction?"
          message="This cannot be undone."
          actions={[
            { label: 'Cancel', variant: 'secondary', onPress: () => setDeleteConfirmOpen(false), disabled: deleting },
            { label: 'Delete', variant: 'destructive', onPress: handleConfirmDelete, loading: deleting },
          ]}
        />
      )}
    </Sheet>
    <MessageDialog
      dialog={messageDialog}
      onClose={() => setMessageDialog(null)}
    />
    </>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: { flex: 1, marginRight: 12, fontSize: 20, fontFamily: F.semibold, color: C.ink },
  headerCancel: { fontSize: 14, fontFamily: F.regular, color: C.ink3 },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 32, gap: 16 },

  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  rupeeSign: { fontSize: 36, fontFamily: F.regular, lineHeight: 48 },
  amountInput: {
    fontSize: 36,
    fontFamily: F.semibold,
    textAlign: 'center',
    minWidth: 100,
    padding: 0,
  },

  twoCol: { flexDirection: 'row', gap: 16 },
  colField: { flex: 1, gap: 6 },

  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: F.medium, color: C.ink3, letterSpacing: 0.4 },

  textInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
    fontSize: 14,
    fontFamily: F.regular,
    color: C.ink,
  },
  inputText: { fontSize: 14, fontFamily: F.regular, color: C.ink },

  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
  },
  selectInner: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  selectText: { flex: 1, fontSize: 14, fontFamily: F.regular, color: C.ink },
  selectPlaceholder: { color: C.ink3 },
  catDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
  },
  toggleLabel: { fontSize: 14, fontFamily: F.regular, color: C.ink },

  saveBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  saveBtnText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
  deleteBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(219,90,75,0.35)' },
  deleteBtnText: { fontSize: 14, fontFamily: F.semibold, color: C.neg },
  btnDisabled: { opacity: 0.4 },

  // Picker sheet header
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
})
