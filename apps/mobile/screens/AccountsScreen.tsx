import React, { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { CreditCardIcon, WalletIcon, PiggyBankIcon, BuildingsIcon, CircleDashedIcon } from 'phosphor-react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createAccount,
  updateAccount,
  deleteAccount,
} from '../repositories/accountRepository'
import { getAccounts } from '../lib/data'
import { invalidateAccountData, queryKeys } from '../lib/query'
import type { Account, AccountType } from '@paisa-buddy/shared/types/account'
import { ACCOUNT_TYPE_LABELS } from '@paisa-buddy/shared/types/account'
import { formatAmount, openingBalanceForType, parseAmountToPaise } from '@paisa-buddy/shared/logic/amount'
import { C, F, RADIUS } from '../lib/tokens'
import { Dialog, MessageDialog, type MessageDialogState } from '../components/Dialog'
import { Sheet } from '../components/Sheet'
import { SwipeableRow } from '../components/SwipeableRow'
import { AnimatedAmount } from '../components/AnimatedAmount'

const ACCOUNT_TYPES: AccountType[] = ['savings', 'current', 'credit', 'wallet', 'other']

type AccountSectionKey = 'bank' | 'credit' | 'wallet' | 'other'

type AccountSection = {
  key: AccountSectionKey
  title: string
  accounts: Account[]
}

function sectionKeyForAccount(type: AccountType): AccountSectionKey {
  if (type === 'savings' || type === 'current') return 'bank'
  if (type === 'credit') return 'credit'
  if (type === 'wallet') return 'wallet'
  return 'other'
}

function buildAccountSections(accounts: Account[]): AccountSection[] {
  const sections: Record<AccountSectionKey, AccountSection> = {
    bank: { key: 'bank', title: 'Bank Accounts', accounts: [] },
    credit: { key: 'credit', title: 'Credit Cards', accounts: [] },
    wallet: { key: 'wallet', title: 'Wallets', accounts: [] },
    other: { key: 'other', title: 'Other Accounts', accounts: [] },
  }

  for (const account of accounts) {
    sections[sectionKeyForAccount(account.type)].accounts.push(account)
  }

  return Object.values(sections).filter((section) => section.accounts.length > 0)
}

function BuddySVG({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Path d="M32 13 C 32 6, 26 3, 23 6 C 21 9, 26 13, 32 13 Z" fill={C.brand} />
      <Path d="M32 13 C 32 7, 38 5, 40 8 C 41 11, 37 14, 32 13 Z" fill="#2BA77F" />
      <Path d="M32 16 L 32 11" stroke={C.brandDeep} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="32" cy="36" r="22" fill={C.brandPale} stroke={C.brand} strokeWidth="2.5" />
      <Circle cx="32" cy="36" r="17" stroke={C.brand} strokeWidth="1.5" strokeOpacity="0.3" />
      <Circle cx="22" cy="40" r="3.2" fill="#F4B8A8" fillOpacity="0.7" />
      <Circle cx="42" cy="40" r="3.2" fill="#F4B8A8" fillOpacity="0.7" />
      <Circle cx="25.5" cy="34" r="2.6" fill={C.brandDeep} />
      <Circle cx="38.5" cy="34" r="2.6" fill={C.brandDeep} />
      <Path d="M25 41 Q32 47 39 41" stroke={C.brandDeep} strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </Svg>
  )
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

function accountIconColors(type: AccountType): { bg: string; fg: string } {
  if (type === 'credit') return { bg: '#FEE2E2', fg: C.neg }
  if (type === 'wallet') return { bg: '#FEF9C3', fg: '#A16207' }
  return { bg: '#D1FAE5', fg: C.brand }
}

function accountPhosphorIcon(type: AccountType, fg: string, iconSize: number) {
  const props = { size: iconSize, weight: 'fill' as const, color: fg }
  if (type === 'savings') return <PiggyBankIcon {...props} />
  if (type === 'current') return <BuildingsIcon {...props} />
  if (type === 'credit') return <CreditCardIcon {...props} />
  if (type === 'wallet') return <WalletIcon {...props} />
  return <CircleDashedIcon {...props} />
}

function AccountIcon({ type, size = 42 }: { type: AccountType; size?: number }) {
  const { bg, fg } = accountIconColors(type)
  const iconSize = Math.round(size * 0.42)

  return (
    <View style={[ico.wrap, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: bg }]}>
      {accountPhosphorIcon(type, fg, iconSize)}
    </View>
  )
}

const ico = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
})

// ─── Hero cards ────────────────────────────────────────────────────────────────

function HeroCard({ totalBalance, bankCount, cardCount, accountCount }: {
  totalBalance: number; bankCount: number; cardCount: number; accountCount: number
}) {
  return (
    <View style={hero.green}>
      <View style={{ opacity: 0.12, position: 'absolute', right: -18, bottom: -12 }}>
        <BuddySVG size={110} />
      </View>
      <Text style={hero.tag}>Total across accounts</Text>
      <AnimatedAmount amount={totalBalance} style={hero.amount} numberOfLines={1} />
      <Text style={hero.sub}>
        {bankCount > 0 ? `${bankCount} bank${bankCount > 1 ? 's' : ''} · ` : ''}
        {cardCount > 0 ? `${cardCount} card${cardCount > 1 ? 's' : ''} · ` : ''}
        {accountCount} account{accountCount !== 1 ? 's' : ''}
      </Text>
    </View>
  )
}

const hero = StyleSheet.create({
  green: {
    backgroundColor: '#1A936F',
    borderRadius: RADIUS,
    padding: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  tag: { fontSize: 10.5, fontFamily: F.bold, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 },
  amount: { fontSize: 28, fontFamily: F.monoBold, color: '#fff', letterSpacing: -0.56, lineHeight: 32 },
  sub: { fontSize: 12.5, color: 'rgba(255,255,255,0.7)', marginTop: 6, fontFamily: F.regular },
})

// ─── Account Sheet ─────────────────────────────────────────────────────────────

type AccForm = { name: string; type: AccountType; bank: string; opening_balance: string }
const DEFAULT_FORM: AccForm = { name: '', type: 'savings', bank: '', opening_balance: '' }

function AccountSheet({
  visible, onClose, editing, onSaved, onDelete,
}: {
  visible: boolean
  onClose: () => void
  editing: Account | null
  onSaved: (acc: Account) => void
  onDelete: (acc: Account) => Promise<void>
}) {
  const [form, setForm] = useState<AccForm>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [messageDialog, setMessageDialog] = useState<MessageDialogState | null>(null)
  const nameRef = useRef<TextInput>(null)

  React.useEffect(() => {
    if (visible) {
      setForm(editing
        ? { name: editing.name, type: editing.type, bank: editing.bank ?? '', opening_balance: String(Math.abs(editing.opening_balance) / 100) }
        : DEFAULT_FORM
      )
      setAccountToDelete(null)
      setDeleting(false)
    }
  }, [visible, editing])

  function setF<K extends keyof AccForm>(key: K, val: AccForm[K]) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function handleSave() {
    const name = form.name.trim()
    if (!name) return
    const rawPaise = parseAmountToPaise(form.opening_balance)
    const opening_balance = openingBalanceForType(rawPaise, form.type)
    setSaving(true)
    try {
      if (editing) {
        const acc = await updateAccount(editing.id, { name, type: form.type, bank: form.bank.trim() || null, opening_balance })
        onSaved(acc)
      } else {
        const acc = await createAccount(name, form.type, form.bank.trim() || null, opening_balance)
        onSaved(acc)
      }
      onClose()
    } catch {
      setMessageDialog({ title: 'Error', message: 'Could not save account.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmDelete() {
    if (!accountToDelete) return
    setDeleting(true)
    try {
      await onDelete(accountToDelete)
    } catch {
      setMessageDialog({ title: 'Error', message: 'Could not delete account.' })
    } finally {
      setDeleting(false)
      setAccountToDelete(null)
    }
  }

  const isCredit = form.type === 'credit'

  return (
    <>
    <Sheet
      visible={visible}
      onClose={onClose}
      heightFraction={0.72}
      onOpen={!editing ? () => nameRef.current?.focus() : undefined}
      title={editing ? 'Edit Account' : 'New Account'}
    >
      <ScrollView contentContainerStyle={af.content} keyboardShouldPersistTaps="handled">
        <View style={af.field}>
          <Text style={af.label}>NAME <Text style={{ color: C.neg }}>*</Text></Text>
          <TextInput
            ref={nameRef}
            style={af.input}
            value={form.name}
            onChangeText={(v) => setF('name', v)}
            placeholder="e.g. HDFC Savings"
            placeholderTextColor={C.ink3}
          />
        </View>

        <View style={af.field}>
          <Text style={af.label}>TYPE</Text>
          <View style={af.chips}>
            {ACCOUNT_TYPES.map((t) => (
              <Pressable
                key={t}
                onPress={() => setF('type', t)}
                style={[af.chip, form.type === t && { backgroundColor: C.brand, borderColor: C.brand }]}
                accessibilityRole="button"
                accessibilityLabel={ACCOUNT_TYPE_LABELS[t]}
                accessibilityState={{ selected: form.type === t }}
              >
                <Text style={[af.chipText, form.type === t && { color: '#fff' }]} numberOfLines={1}>{ACCOUNT_TYPE_LABELS[t]}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={af.field}>
          <Text style={af.label}>BANK</Text>
          <TextInput
            style={af.input}
            value={form.bank}
            onChangeText={(v) => setF('bank', v)}
            placeholder="e.g. HDFC Bank"
            placeholderTextColor={C.ink3}
          />
        </View>

        <View style={af.field}>
          <Text style={af.label}>{isCredit ? 'AMOUNT TO BE SETTLED' : 'OPENING BALANCE'}</Text>
          <View style={af.amountRow}>
            <Text style={af.rupee}>₹</Text>
            <TextInput
              style={af.amountInput}
              value={form.opening_balance}
              onChangeText={(v) => setF('opening_balance', v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={C.ink3}
            />
          </View>
          {isCredit && (
            <Text style={af.hint}>
              Outstanding credit card dues are stored as a negative balance.
            </Text>
          )}
        </View>

        <Pressable
          style={[af.save, (!form.name.trim() || saving) && { opacity: 0.4 }]}
          onPress={handleSave}
          disabled={!form.name.trim() || saving}
        >
          <Text style={af.saveText}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Account'}</Text>
        </Pressable>
        {editing ? (
          <Pressable
            style={af.delete}
            onPress={() => setAccountToDelete(editing)}
          >
            <Text style={af.deleteText}>Delete Account</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Dialog
        visible={!!accountToDelete}
        onClose={() => { if (!deleting) setAccountToDelete(null) }}
        title={accountToDelete ? `Delete "${accountToDelete.name}"?` : 'Delete account?'}
        message="Transactions linked to this account will be unlinked but not deleted."
        actions={[
          { label: 'Cancel', variant: 'secondary', onPress: () => setAccountToDelete(null), disabled: deleting },
          { label: 'Delete', variant: 'destructive', onPress: handleConfirmDelete, loading: deleting },
        ]}
      />
    </Sheet>
    <MessageDialog
      dialog={messageDialog}
      onClose={() => setMessageDialog(null)}
    />
    </>
  )
}

const af = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: F.medium, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: F.regular, color: C.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg },
  chipText: { fontSize: 13.5, fontFamily: F.medium, color: C.ink2, flexShrink: 0 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 10 },
  rupee: { fontSize: 14, fontFamily: F.medium, color: C.ink3 },
  amountInput: { flex: 1, fontSize: 14, fontFamily: F.mono, color: C.ink, padding: 0 },
  save: { backgroundColor: C.brand, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
  delete: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(219,90,75,0.35)' },
  deleteText: { fontSize: 14, fontFamily: F.semibold, color: C.neg },
  hint: { fontSize: 11.5, fontFamily: F.regular, color: C.ink3, lineHeight: 17, marginTop: 4 },
})

// ─── AccountsScreen ────────────────────────────────────────────────────────────

export function AccountsScreen() {
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const addAccScale = useSharedValue(1)
  const addAccAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: addAccScale.value }] }))
  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: getAccounts,
  })
  const accounts = accountsQuery.data ?? []

  // Account sheet
  const [accSheetOpen, setAccSheetOpen] = useState(false)
  const [editingAcc, setEditingAcc] = useState<Account | null>(null)
  const [deleteConfirmAcc, setDeleteConfirmAcc] = useState<Account | null>(null)
  const [deletingSwipeAcc, setDeletingSwipeAcc] = useState(false)
  const [messageDialog, setMessageDialog] = useState<MessageDialogState | null>(null)

  const loading = accountsQuery.isLoading
  const totalBalance = accounts.reduce((sum, account) => sum + account.current_balance, 0)
  const bankCount = accounts.filter((account) => account.type === 'savings' || account.type === 'current').length
  const cardCount = accounts.filter((account) => account.type === 'credit').length
  const accountSections = buildAccountSections(accounts)

  function openAddAcc() { setEditingAcc(null); setAccSheetOpen(true) }
  function openEditAcc(acc: Account) { setEditingAcc(acc); setAccSheetOpen(true) }

  function handleAccSaved(acc: Account) {
    queryClient.setQueryData<Account[]>(queryKeys.accounts, (prev = []) => {
      const idx = prev.findIndex((a) => a.id === acc.id)
      if (idx === -1) return [...prev, acc]
      const next = [...prev]; next[idx] = acc; return next
    })
    invalidateAccountData(queryClient)
  }

  async function handleDeleteAcc(acc: Account) {
    await deleteAccount(acc.id)
    queryClient.setQueryData<Account[]>(queryKeys.accounts, (prev = []) => prev.filter((a) => a.id !== acc.id))
    invalidateAccountData(queryClient)
    setAccSheetOpen(false)
    setEditingAcc(null)
  }

  async function handleConfirmSwipeAccDelete() {
    if (!deleteConfirmAcc) return
    setDeletingSwipeAcc(true)
    try {
      await handleDeleteAcc(deleteConfirmAcc)
      setDeleteConfirmAcc(null)
    } catch {
      setMessageDialog({ title: 'Error', message: 'Could not delete account.' })
    } finally {
      setDeletingSwipeAcc(false)
    }
  }

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <Text style={s.pageTitle}>Accounts</Text>
          <Pressable
            onPress={openAddAcc}
            onPressIn={() => { addAccScale.value = withSpring(0.9, { damping: 15, stiffness: 300 }) }}
            onPressOut={() => { addAccScale.value = withSpring(1, { damping: 15, stiffness: 300 }) }}
          >
            <Animated.View style={[s.addBtn, addAccAnimStyle]}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                <Path d="M12 5v14M5 12h14" />
              </Svg>
              <Text style={s.addBtnText}>Add</Text>
            </Animated.View>
          </Pressable>
        </View>

        {loading ? (
          <View style={s.loadingWrap}><ActivityIndicator color={C.brand} /></View>
        ) : (
          <View style={s.body}>
            {/* Accounts section */}
            {accounts.length === 0 ? (
              <View style={s.emptyState}>
                <Svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <Rect x="2" y="5" width="20" height="14" rx="2" />
                  <Path d="M2 10h20" />
                </Svg>
                <Text style={s.emptyText}>No accounts yet</Text>
                <Pressable onPress={openAddAcc}><Text style={s.emptyLink}>Add your first account</Text></Pressable>
              </View>
            ) : (
              <>
                <HeroCard totalBalance={totalBalance} bankCount={bankCount} cardCount={cardCount} accountCount={accounts.length} />
                <View style={s.sections}>
                  {accountSections.map((section) => (
                    <View key={section.key} style={s.section}>
                      <View style={s.sectionHeader}>
                        <Text style={s.sectionTitle}>{section.title}</Text>
                      </View>
                      <View style={s.listCard}>
                        {section.accounts.map((acc, idx) => {
                          const balColor = acc.current_balance >= 0 ? C.pos : C.neg
                          return (
                            <SwipeableRow
                              key={acc.id}
                              actionLabel="Delete"
                              onAction={() => setDeleteConfirmAcc(acc)}
                            >
                              <Pressable
                                style={[s.listRow, idx < section.accounts.length - 1 && s.listRowBorder]}
                                onPress={() => openEditAcc(acc)}
                              >
                                <AccountIcon type={acc.type} />
                                <View style={s.listInfo}>
                                  <Text style={s.listName} numberOfLines={1}>{acc.name}</Text>
                                  <Text style={s.listSub} numberOfLines={1}>
                                    {ACCOUNT_TYPE_LABELS[acc.type]}{acc.bank ? ` · ${acc.bank}` : ''}
                                  </Text>
                                </View>
                                <Text style={[s.listBalance, { color: balColor }]} numberOfLines={1}>
                                  {formatAmount(acc.current_balance)}
                                </Text>
                              </Pressable>
                            </SwipeableRow>
                          )
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

          </View>
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      <AccountSheet
        visible={accSheetOpen}
        onClose={() => setAccSheetOpen(false)}
        editing={editingAcc}
        onSaved={handleAccSaved}
        onDelete={handleDeleteAcc}
      />
      <Dialog
        visible={!!deleteConfirmAcc}
        onClose={() => { if (!deletingSwipeAcc) setDeleteConfirmAcc(null) }}
        title={deleteConfirmAcc ? `Delete "${deleteConfirmAcc.name}"?` : 'Delete account?'}
        message="Transactions linked to this account will be unlinked but not deleted."
        actions={[
          { label: 'Cancel', variant: 'secondary', onPress: () => setDeleteConfirmAcc(null), disabled: deletingSwipeAcc },
          { label: 'Delete', variant: 'destructive', onPress: handleConfirmSwipeAccDelete, loading: deletingSwipeAcc },
        ]}
      />
      <MessageDialog
        dialog={messageDialog}
        onClose={() => setMessageDialog(null)}
      />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingBottom: 10 },
  pageTitle: { fontSize: 23, fontFamily: F.extrabold, color: C.ink },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: C.brand, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 8,
    shadowColor: C.brand, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  addBtnText: { fontSize: 13.5, fontFamily: F.bold, color: '#fff' },
  loadingWrap: { paddingTop: 80, alignItems: 'center' },
  body: { paddingHorizontal: 18, paddingTop: 4, gap: 12 },
  sections: { gap: 16, marginTop: 8 },
  section: {},
  sectionHeader: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: F.extrabold, color: C.ink },
  listCard: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
  },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, paddingHorizontal: 16 },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  listInfo: { flex: 1, minWidth: 0 },
  listName: { fontSize: 14, fontFamily: F.semibold, color: C.ink },
  listSub: { fontSize: 12, fontFamily: F.regular, color: C.ink3, marginTop: 1 },
  listBalance: { fontSize: 14, fontFamily: F.monoBold, flexShrink: 0 },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: F.regular, color: C.ink3 },
  emptyLink: { fontSize: 13, fontFamily: F.semibold, color: C.brand },
})
