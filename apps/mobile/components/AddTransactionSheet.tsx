import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { Sheet } from './Sheet'
import { C, F, RADIUS } from '../lib/tokens'
import {
  createTransaction,
  updateTransaction,
  createAccount,
  createCategory,
  type TxInput,
} from '../lib/api'
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
import type { Account, AccountType } from '@paisa-buddy/shared/types/account'
import { ACCOUNT_TYPE_LABELS } from '@paisa-buddy/shared/types/account'

type Props = {
  visible: boolean
  onClose: () => void
  onSaved: (tx: Transaction, isEdit: boolean) => void
  accounts: Account[]
  catColors: Record<string, string>
  editTx?: Transaction | null
  onAccountCreated?: (acc: Account) => void
  onCategoryCreated?: (name: string, color: string) => void
}

const TYPES: Array<{ value: TransactionType; label: string; color: string }> = [
  { value: 'credit',   label: 'Credit',   color: C.pos },
  { value: 'debit',    label: 'Debit',    color: C.neg },
  { value: 'transfer', label: 'Transfer', color: C.transfer },
]

const ACCOUNT_TYPES: AccountType[] = ['savings', 'current', 'credit', 'wallet', 'other']

function toRupeeStr(paise: number): string {
  const r = paise / 100
  return Number.isInteger(r) ? String(r) : r.toFixed(2)
}

export function AddTransactionSheet({
  visible,
  onClose,
  onSaved,
  accounts: baseAccounts,
  catColors: baseCatColors,
  editTx,
  onAccountCreated,
  onCategoryCreated,
}: Props) {
  const isEdit = !!editTx

  const [type, setType] = useState<TransactionType>('debit')
  const [amountStr, setAmountStr] = useState('')
  const [merchant, setMerchant] = useState('')
  const [category, setCategory] = useState('')
  const [accountId, setAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [date, setDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Extra accounts / categories added inline
  const [extraAccounts, setExtraAccounts] = useState<Account[]>([])
  const [extraCatColors, setExtraCatColors] = useState<Record<string, string>>({})

  // Inline add account state
  const [addingAccount, setAddingAccount] = useState(false)
  const [newAccName, setNewAccName] = useState('')
  const [newAccType, setNewAccType] = useState<AccountType>('savings')
  const [addingAccSaving, setAddingAccSaving] = useState(false)

  // Inline add category state
  const [addingCat, setAddingCat] = useState(false)
  const [newCatInput, setNewCatInput] = useState('')
  const [addingCatSaving, setAddingCatSaving] = useState(false)

  const allAccounts = [...baseAccounts, ...extraAccounts.filter((a) => !baseAccounts.find((x) => x.id === a.id))]
  const allCatColors = { ...baseCatColors, ...extraCatColors }
  const customCatKeys = Object.keys(allCatColors)
  const allCategories = [...new Set([...PREDEFINED_CATEGORIES, ...customCatKeys])]

  // Sync when sheet opens / editTx changes
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
      setAddingAccount(false)
      setAddingCat(false)
      setExtraAccounts([])
      setExtraCatColors({})
    }
  }, [visible, editTx])

  // Transfer: auto-fill merchant from selected to-account
  useEffect(() => {
    if (type === 'transfer' && toAccountId) {
      const acc = allAccounts.find((a) => a.id === toAccountId)
      if (acc) setMerchant(acc.name)
    }
  }, [toAccountId, type])

  const activeType = TYPES.find((t) => t.value === type)!
  const merchantLabel = type === 'credit' ? 'SENDER' : type === 'transfer' ? 'ACCOUNT' : 'RECIPIENT'
  const merchantPlaceholder =
    type === 'credit' ? 'Who sent this?' :
    type === 'transfer' ? 'Which account?' :
    'Who did you pay?'

  const toAccounts = allAccounts.filter((a) => a.id !== accountId)
  const isTransferMerchantReadOnly = type === 'transfer' && !!toAccountId

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
      onSaved(tx, isEdit)
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
      onAccountCreated?.(acc)
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
      onCategoryCreated?.(result.name, result.color)
      setAddingCat(false)
      setNewCatInput('')
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create category.')
    } finally {
      setAddingCatSaving(false)
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      heightFraction={0.88}
    >
      {/* Header */}
      <View style={s.sheetHeader}>
        <Text style={s.sheetTitle}>{isEdit ? 'Edit transaction' : 'Add transaction'}</Text>
        <Pressable onPress={onClose} style={s.sheetCancelBtn} hitSlop={8}>
          <Text style={s.sheetCancelText}>Cancel</Text>
        </Pressable>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Type selector ── */}
        <View style={s.typeBar}>
          {TYPES.map((t) => {
            const active = type === t.value
            return (
              <Pressable
                key={t.value}
                style={[s.typeBtn, active && s.typeBtnActive]}
                onPress={() => setType(t.value)}
              >
                <Text style={[s.typeBtnText, { color: active ? t.color : C.ink3 }]}>
                  {t.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {/* ── Amount ── */}
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
            autoFocus={!isEdit}
          />
          {/* invisible spacer mirrors the ₹ to keep amount visually centered */}
          <Text style={[s.rupeeSign, { color: 'transparent' }]} aria-hidden>₹</Text>
        </View>

        {/* ── Category ── */}
        <View style={s.field}>
          <Text style={s.label}>CATEGORY</Text>
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

        {/* ── Account ── */}
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

        {/* ── To Account (transfer only) ── */}
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

        {/* ── Merchant / Sender / Account name ── */}
        <View style={s.field}>
          <Text style={s.label}>{merchantLabel} <Text style={{ color: C.neg }}>*</Text></Text>
          <TextInput
            style={[s.textInput, isTransferMerchantReadOnly && s.textInputReadOnly]}
            value={merchant}
            onChangeText={isTransferMerchantReadOnly ? undefined : setMerchant}
            placeholder={merchantPlaceholder}
            placeholderTextColor={C.ink3}
            editable={!isTransferMerchantReadOnly}
            returnKeyType="next"
          />
        </View>

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
            style={s.datePressable}
            onPress={() => {
              if (Platform.OS === 'android') {
                DateTimePickerAndroid.open({
                  value: date,
                  mode: 'date',
                  maximumDate: new Date(),
                  onChange: (_, selected) => { if (selected) setDate(selected) },
                })
              } else {
                setShowDatePicker(true)
              }
            }}
          >
            <Text style={s.dateText}>
              {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </Pressable>
          {showDatePicker && Platform.OS === 'ios' && (
            <DateTimePicker
              value={date}
              mode="date"
              display="inline"
              onChange={(_, selected) => { if (selected) setDate(selected) }}
              maximumDate={new Date()}
            />
          )}
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
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  sheetTitle: { fontSize: 16, fontFamily: F.semibold, color: C.ink },
  sheetCancelBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  sheetCancelText: { fontSize: 15, fontFamily: F.regular, color: C.brand },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 20 },

  // Type selector
  typeBar: {
    flexDirection: 'row',
    backgroundColor: C.bg,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  typeBtnActive: {
    backgroundColor: C.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  typeBtnText: { fontSize: 14, fontFamily: F.semibold },

  // Amount — 3.5rem = 56px, invisible spacer mirrors ₹ for centering
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
  label: {
    fontSize: 12,
    fontFamily: F.medium,
    color: C.ink3,
    letterSpacing: 0.4,
  },

  // px-3 = 12, py-1.5 = 6, rounded-full, text-sm = 14
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

  inlineInputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inlineInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
    fontSize: 14,
    fontFamily: F.regular,
    color: C.ink,
    minWidth: 128,
  },
  inlineConfirm: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineConfirmText: { fontSize: 14, fontFamily: F.semibold, color: C.ink },

  // p-3 = 12, gap-2 = 8
  addAccountForm: {
    backgroundColor: C.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    padding: 12,
    gap: 8,
  },
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

  // px-3 = 12, py-2.5 = 10, rounded-xl = 12, text-sm = 14
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

  datePressable: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
  },
  dateText: { fontSize: 14, fontFamily: F.regular, color: C.ink },

  // py-3.5 = 14, rounded-xl = 12, text-sm = 14
  submitBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
})
