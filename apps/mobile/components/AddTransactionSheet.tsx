import React, { useEffect, useRef, useState } from 'react'
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
import Svg, { Polyline } from 'react-native-svg'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { useQueryClient } from '@tanstack/react-query'
import { Sheet } from './Sheet'
import { TypePicker } from './TypePicker'
import { C, F, RADIUS } from '../lib/tokens'
import {
  createTransaction,
  updateTransaction,
  type TxInput,
} from '../lib/api'
import { invalidateTransactionData } from '../lib/query'
import {
  PREDEFINED_CATEGORIES,
  categoryColor,
} from '@paisa-buddy/shared/categories'
import {
  sanitizeAmountInput,
  parseAmountToPaise,
  formatDisplayAmount,
} from '@paisa-buddy/shared/logic/amount'
import type { Transaction, TransactionType } from '@paisa-buddy/shared/types/transaction'
import type { Account } from '@paisa-buddy/shared/types/account'

type Props = {
  visible: boolean
  onClose: () => void
  onSaved: (tx: Transaction, isEdit: boolean) => void
  accounts: Account[]
  catColors: Record<string, string>
  editTx?: Transaction | null
  recentCategories?: string[]
}

const TYPES: Array<{ value: TransactionType; label: string; color: string }> = [
  { value: 'credit',   label: 'Credit',   color: C.pos },
  { value: 'debit',    label: 'Debit',    color: C.neg },
  { value: 'transfer', label: 'Transfer', color: C.transfer },
]

function toRupeeStr(paise: number): string {
  const r = paise / 100
  return Number.isInteger(r) ? String(r) : r.toFixed(2)
}

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

export function AddTransactionSheet({
  visible,
  onClose,
  onSaved,
  accounts,
  catColors,
  editTx,
  recentCategories = [],
}: Props) {
  const queryClient = useQueryClient()
  const isEdit = !!editTx
  const amountRef = useRef<TextInput>(null)

  const [type, setType] = useState<TransactionType>('debit')
  const [amountStr, setAmountStr] = useState('')
  const [merchant, setMerchant] = useState('')
  const [category, setCategory] = useState('')
  const [accountId, setAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [date, setDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pendingDate, setPendingDate] = useState(new Date())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const [catPickerOpen, setCatPickerOpen] = useState(false)
  const [accPickerOpen, setAccPickerOpen] = useState(false)
  const [toAccPickerOpen, setToAccPickerOpen] = useState(false)

  const customCatKeys = Object.keys(catColors)
  const allCategories = [...new Set([...PREDEFINED_CATEGORIES, ...customCatKeys])]

  const recentCats = recentCategories.filter((c) => allCategories.includes(c)).slice(0, 3)
  const restCats = allCategories.filter((c) => !recentCats.includes(c))

  useEffect(() => {
    if (visible) {
      setType(editTx?.type ?? 'debit')
      setAmountStr(editTx ? toRupeeStr(editTx.amount) : '')
      setMerchant(editTx?.merchant ?? '')
      setCategory(editTx?.category ?? '')
      setAccountId(editTx?.account_id ?? '')
      setToAccountId(editTx?.to_account_id ?? '')
      setDate(editTx ? new Date(editTx.date + 'T00:00:00') : new Date())
      setShowDatePicker(false)
      setNotes(editTx?.description ?? '')
    }
  }, [visible, editTx])

  useEffect(() => {
    if (type === 'transfer' && toAccountId) {
      const acc = accounts.find((a) => a.id === toAccountId)
      if (acc) setMerchant(acc.name)
    }
  }, [toAccountId, type])

  const activeType = TYPES.find((t) => t.value === type)!
  const merchantLabel = type === 'credit' ? 'SENDER' : type === 'transfer' ? 'ACCOUNT' : 'RECIPIENT'
  const merchantPlaceholder =
    type === 'credit' ? 'Who sent this?' :
    type === 'transfer' ? 'Which account?' :
    'Who did you pay?'

  const toAccounts = accounts.filter((a) => a.id !== accountId)
  const selectedAccountName = accounts.find((a) => a.id === accountId)?.name
  const selectedToAccountName = toAccounts.find((a) => a.id === toAccountId)?.name

  const isValid =
    !!amountStr &&
    parseAmountToPaise(amountStr) > 0 &&
    !!merchant.trim() &&
    !!category &&
    !!accountId &&
    (type !== 'transfer' || !!toAccountId)

  async function handleSave() {
    if (!isValid) return
    setSaving(true)
    try {
      const payload: TxInput = {
        type,
        amount: parseAmountToPaise(amountStr),
        date: date.toISOString().slice(0, 10),
        merchant: merchant.trim(),
        description: notes.trim(),
        category,
        account_id: accountId,
        to_account_id: type === 'transfer' ? toAccountId : null,
      }
      const tx = isEdit
        ? await updateTransaction(editTx!.id, payload)
        : await createTransaction(payload)
      invalidateTransactionData(queryClient)
      onSaved(tx, isEdit)
      onClose()
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onOpen={isEdit ? undefined : () => amountRef.current?.focus()}
      heightFraction={0.88}
      header={(
        <View style={s.sheetHeader}>
          <Text style={s.sheetTitle}>{isEdit ? 'Edit transaction' : 'Add transaction'}</Text>
          <Pressable onPress={onClose} style={s.sheetCancelBtn} hitSlop={8}>
            <Text style={s.sheetCancelText}>Cancel</Text>
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
        {/* ── Type selector ── */}
        <TypePicker types={TYPES} active={type} onChange={setType} />

        {/* ── Amount ── */}
        <View style={s.amountRow}>
          <Text style={[s.rupeeSign, { color: activeType.color }]}>₹</Text>
          <TextInput
            ref={amountRef}
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

        {/* ── Category ── */}
        <View style={s.field}>
          <Text style={s.label}>CATEGORY</Text>
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

        {/* ── Account ── */}
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

        {/* ── To Account (transfer only) ── */}
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

        {/* ── Merchant / Sender ── */}
        {type !== 'transfer' && (
          <View style={s.field}>
            <Text style={s.label}>{merchantLabel} <Text style={{ color: C.neg }}>*</Text></Text>
            <TextInput
              style={s.textInput}
              value={merchant}
              onChangeText={setMerchant}
              placeholder={merchantPlaceholder}
              placeholderTextColor={C.ink3}
              returnKeyType="next"
            />
          </View>
        )}

        {/* ── Notes ── */}
        <View style={s.field}>
          <Text style={s.label}>NOTES</Text>
          <TextInput
            style={s.textInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="What was this for?"
            placeholderTextColor={C.ink3}
            returnKeyType="next"
          />
        </View>

        {/* ── Date ── */}
        <View style={s.field}>
          <Text style={s.label}>DATE</Text>
          <Pressable
            style={s.textInput}
            onPress={() => {
              if (Platform.OS === 'android') {
                DateTimePickerAndroid.open({
                  value: date,
                  mode: 'date',
                  maximumDate: new Date(),
                  onChange: (_, selected) => { if (selected) setDate(selected) },
                })
              } else {
                setPendingDate(date)
                setShowDatePicker(true)
              }
            }}
          >
            <Text style={s.dateText}>
              {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </Pressable>
        </View>

        {/* ── Submit ── */}
        <Pressable
          style={[s.submitBtn, { backgroundColor: activeType.color }, (!isValid || saving) && s.btnDisabled]}
          onPress={handleSave}
          disabled={!isValid || saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.submitBtnText}>{isEdit ? 'Save changes' : 'Add Transaction'}</Text>
          }
        </Pressable>
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
                onPress={() => { setDate(pendingDate); setShowDatePicker(false) }}
              >
                <Text style={s.modalDoneText}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}
    </Sheet>
  )
}

const s = StyleSheet.create({
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

  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 20 },

  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  rupeeSign: { fontSize: 56, fontFamily: F.regular, lineHeight: 68 },
  amountInput: {
    fontSize: 56,
    fontFamily: F.semibold,
    textAlign: 'center',
    minWidth: 120,
    padding: 0,
  },

  field: { gap: 8 },
  label: { fontSize: 12, fontFamily: F.medium, color: C.ink3, letterSpacing: 0.4 },

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
  textInputReadOnly: { color: C.ink3 },
  dateText: { fontSize: 14, fontFamily: F.regular, color: C.ink },

  submitBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
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
