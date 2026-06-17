import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { Sheet } from './Sheet'
import { TypePicker } from './TypePicker'
import { C, F, RADIUS } from '../lib/tokens'
import { updateTransaction, createAccount, createCategory } from '../lib/api'
import { PREDEFINED_CATEGORIES } from '@paisa-buddy/shared/categories'
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
import type { Account, AccountType } from '@paisa-buddy/shared/types/account'
import { ACCOUNT_TYPE_LABELS } from '@paisa-buddy/shared/types/account'

type Props = {
  tx: Transaction | null
  visible: boolean
  onClose: () => void
  onSaved: (tx: Transaction) => void
  accounts: Account[]
  catColors: Record<string, string>
}

const TYPES: Array<{ value: TransactionType; label: string; color: string }> = [
  { value: 'credit', label: 'Credit', color: C.pos },
  { value: 'debit', label: 'Debit', color: C.neg },
  { value: 'transfer', label: 'Transfer', color: C.transfer },
]
const ACCOUNT_TYPES: AccountType[] = ['savings', 'current', 'credit', 'wallet', 'other']

export function TransactionDetailSheet({
  tx,
  visible,
  onClose,
  onSaved,
  accounts: baseAccounts,
  catColors,
}: Props) {
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
  const [saving, setSaving] = useState(false)

  const [extraAccounts, setExtraAccounts] = useState<Account[]>([])
  const [extraCatColors, setExtraCatColors] = useState<Record<string, string>>({})
  const [addingAccount, setAddingAccount] = useState(false)
  const [newAccName, setNewAccName] = useState('')
  const [newAccType, setNewAccType] = useState<AccountType>('savings')
  const [addingAccSaving, setAddingAccSaving] = useState(false)
  const [newCatInput, setNewCatInput] = useState('')
  const [addingCatSaving, setAddingCatSaving] = useState(false)

  const allAccounts = [...baseAccounts, ...extraAccounts.filter((a) => !baseAccounts.find((x) => x.id === a.id))]
  const allCatColors = { ...catColors, ...extraCatColors }
  const allCategories = [...new Set([...PREDEFINED_CATEGORIES, ...Object.keys(allCatColors)])]
  const toAccounts = allAccounts.filter((a) => a.id !== accountId)

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
      setAddingAccount(false)
      setNewAccName('')
      setNewCatInput('')
      setExtraAccounts([])
      setExtraCatColors({})
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

  async function handleSave() {
    if (!tx || !isValid) return
    setSaving(true)
    try {
      const payload = formStateToPayload({ type, amountStr, date, time, merchant, description, category, accountId, toAccountId, bank, upiRef, isRecurring, investmentId: '' })
      const updated = await updateTransaction(tx.id, tx.reviewed ? payload : { ...payload, reviewed: true })
      onSaved(updated)
      onClose()
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddAccount() {
    const name = newAccName.trim()
    if (!name) return
    setAddingAccSaving(true)
    try {
      const acc = await createAccount(name, newAccType)
      setExtraAccounts((prev) => [...prev, acc])
      setAccountId(acc.id)
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
      setCategory(result.name)
      setNewCatInput('')
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create category.')
    } finally {
      setAddingCatSaving(false)
    }
  }

  if (!tx) return null

  return (
    <Sheet visible={visible} onClose={onClose} heightFraction={0.92}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Edit Transaction</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={s.headerCancel}>Cancel</Text>
        </Pressable>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Type selector */}
        <TypePicker types={TYPES} active={type} onChange={setType} />

        {/* Amount — 2.25rem = 36px */}
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

        {/* Date + Time — 2-col */}
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
            <TextInput
              style={s.textInput}
              value={time}
              onChangeText={setTime}
              placeholder="HH:MM"
              placeholderTextColor={C.ink3}
              keyboardType="numbers-and-punctuation"
              returnKeyType="done"
            />
          </View>
        </View>

        {/* Merchant */}
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
          <View style={s.chips}>
            {allCategories.map((cat) => {
              const active = category === cat
              return (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(active ? '' : cat)}
                  style={[s.chip, active && { backgroundColor: activeType.color, borderColor: activeType.color }]}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>{cat}</Text>
                </Pressable>
              )
            })}
          </View>
          {/* Always-visible inline add row */}
          <View style={s.catAddRow}>
            <TextInput
              style={s.catAddInput}
              placeholder="New category…"
              placeholderTextColor={C.ink3}
              value={newCatInput}
              onChangeText={setNewCatInput}
              returnKeyType="done"
              onSubmitEditing={handleAddCategory}
            />
            <Pressable
              onPress={handleAddCategory}
              disabled={!newCatInput.trim() || addingCatSaving}
            >
              {addingCatSaving
                ? <ActivityIndicator size="small" color={C.brand} />
                : <Text style={[s.catAddBtn, !newCatInput.trim() && s.catAddBtnDim]}>Add</Text>
              }
            </Pressable>
          </View>
        </View>

        {/* Account */}
        <View style={s.field}>
          <Text style={s.label}>ACCOUNT <Text style={{ color: C.neg }}>*</Text></Text>
          {allAccounts.length > 0 && (
            <View style={s.chips}>
              {allAccounts.map((acc) => {
                const active = accountId === acc.id
                return (
                  <Pressable
                    key={acc.id}
                    onPress={() => setAccountId(active ? '' : acc.id)}
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={[s.chips, { flexWrap: 'nowrap', marginTop: 0 }]}>
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
        {type === 'transfer' && (
          <View style={s.field}>
            <Text style={s.label}>TO ACCOUNT <Text style={{ color: C.neg }}>*</Text></Text>
            <View style={s.chips}>
              {toAccounts.map((acc) => {
                const active = toAccountId === acc.id
                return (
                  <Pressable
                    key={acc.id}
                    onPress={() => setToAccountId(active ? '' : acc.id)}
                    style={[s.chip, active && { backgroundColor: activeType.color, borderColor: activeType.color }]}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>{acc.name}</Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        )}

        {/* Bank + UPI Ref — 2-col */}
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

      </ScrollView>

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
    </Sheet>
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
  headerTitle: { fontSize: 20, fontFamily: F.semibold, color: C.ink },
  headerCancel: { fontSize: 14, fontFamily: F.regular, color: C.ink3 },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 32, gap: 16 },


  // Amount — 2.25rem = 36px
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

  // 2-column layout
  twoCol: { flexDirection: 'row', gap: 16 },
  colField: { flex: 1, gap: 6 },

  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: F.medium, color: C.ink3, letterSpacing: 0.4 },

  // px-3=12, py-2.5=10, rounded-xl=12, text-sm=14
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

  // Chips
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
  },
  chipSm: { paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 14, fontFamily: F.regular, color: C.ink },
  chipSmText: { fontSize: 12, fontFamily: F.regular, color: C.ink },
  chipTextActive: { color: '#fff', fontFamily: F.medium },
  chipDashed: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.line,
    backgroundColor: C.bg,
  },
  chipDashedText: { fontSize: 14, fontFamily: F.regular, color: C.ink3 },

  // Always-visible inline category add row
  catAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
  },
  catAddInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: F.regular,
    color: C.ink,
    padding: 0,
  },
  catAddBtn: { fontSize: 12, fontFamily: F.bold, color: C.brand },
  catAddBtnDim: { opacity: 0.4 },

  // Add account form
  addAccountForm: { gap: 8 },
  addFormActions: { flexDirection: 'row', gap: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.line,
  },
  cancelBtnText: { fontSize: 12, fontFamily: F.regular, color: C.ink3 },
  addBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: C.brand,
  },
  addBtnText: { fontSize: 12, fontFamily: F.semibold, color: '#fff' },
  btnDisabled: { opacity: 0.4 },

  // Recurring toggle row
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

  // Save button
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },

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
  pickerWrapper: {
    alignItems: 'center',
    backgroundColor: C.surface,
  },
  modalDoneBtn: {
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: C.brand,
  },
  modalDoneText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
})
