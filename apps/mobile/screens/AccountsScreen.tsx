import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import {
  createAccount,
  updateAccount,
  deleteAccount,
  listInvestments,
  createInvestment,
  updateInvestment,
  deleteInvestment,
} from '../lib/api'
import type { Account, AccountType } from '@paisa-buddy/shared/types/account'
import { ACCOUNT_TYPE_LABELS } from '@paisa-buddy/shared/types/account'
import type { InvestmentWithTotal } from '@paisa-buddy/shared/types/investment'
import { deriveAccountsSummary } from '@paisa-buddy/shared/logic/accounts'
import { formatAmount, openingBalanceForType, parseAmountToPaise } from '@paisa-buddy/shared/logic/amount'
import { C, F, RADIUS } from '../lib/tokens'
import { Sheet } from '../components/Sheet'
import { supabase } from '../lib/supabase'

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

const ACCOUNT_TYPES: AccountType[] = ['savings', 'current', 'credit', 'wallet', 'other']

// ─── Icons ─────────────────────────────────────────────────────────────────────

function accountIconColors(type: AccountType): { bg: string; fg: string } {
  if (type === 'credit') return { bg: '#FEE2E2', fg: C.neg }
  if (type === 'wallet') return { bg: '#FEF9C3', fg: '#A16207' }
  return { bg: '#D1FAE5', fg: C.brand }
}

function AccountIcon({ type, size = 42 }: { type: AccountType; size?: number }) {
  const { bg, fg } = accountIconColors(type)
  return (
    <View style={[ico.wrap, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: bg }]}>
      {type === 'wallet' ? (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M20 12V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
          <Path d="M16 12h4v4h-4z" />
        </Svg>
      ) : (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Rect x="2" y="5" width="20" height="14" rx="2" />
          <Path d="M2 10h20" />
        </Svg>
      )}
    </View>
  )
}

function InvestmentIcon({ size = 42 }: { size?: number }) {
  return (
    <View style={[ico.wrap, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: '#FEF3C7' }]}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#C99A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <Polyline points="16 7 22 7 22 13" />
      </Svg>
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
        <Svg width={110} height={110} viewBox="0 0 64 64" fill="none">
          <Circle cx="32" cy="36" r="22" fill="#fff" />
        </Svg>
      </View>
      <Text style={hero.tag}>Total across accounts</Text>
      <Text style={hero.amount}>{formatAmount(totalBalance)}</Text>
      <Text style={hero.sub}>
        {bankCount > 0 ? `${bankCount} bank${bankCount > 1 ? 's' : ''} · ` : ''}
        {cardCount > 0 ? `${cardCount} card${cardCount > 1 ? 's' : ''} · ` : ''}
        {accountCount} account{accountCount !== 1 ? 's' : ''}
      </Text>
    </View>
  )
}

function InvHeroCard({ totalInvested, count }: { totalInvested: number; count: number }) {
  return (
    <View style={hero.gold}>
      <Text style={hero.tag}>Total invested</Text>
      <Text style={hero.amount}>{formatAmount(totalInvested)}</Text>
      <Text style={hero.sub}>{count} investment{count !== 1 ? 's' : ''}</Text>
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
  gold: {
    backgroundColor: '#C99A2E',
    borderRadius: RADIUS,
    padding: 20,
    overflow: 'hidden',
  },
  tag: { fontSize: 10.5, fontFamily: F.bold, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 },
  amount: { fontSize: 28, fontFamily: F.monoBold, color: '#fff', letterSpacing: -0.56, lineHeight: 32 },
  sub: { fontSize: 12.5, color: 'rgba(255,255,255,0.7)', marginTop: 6, fontFamily: F.regular },
})

// ─── Account Sheet ─────────────────────────────────────────────────────────────

type AccForm = { name: string; type: AccountType; bank: string; opening_balance: string }
const DEFAULT_FORM: AccForm = { name: '', type: 'savings', bank: '', opening_balance: '' }

function AccountSheet({
  visible, onClose, editing, onSaved,
}: {
  visible: boolean
  onClose: () => void
  editing: Account | null
  onSaved: (acc: Account) => void
}) {
  const [form, setForm] = useState<AccForm>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  React.useEffect(() => {
    if (visible) {
      setForm(editing
        ? { name: editing.name, type: editing.type, bank: editing.bank ?? '', opening_balance: String(Math.abs(editing.opening_balance) / 100) }
        : DEFAULT_FORM
      )
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
      Alert.alert('Error', 'Could not save account.')
    } finally {
      setSaving(false)
    }
  }

  const isCredit = form.type === 'credit'

  return (
    <Sheet visible={visible} onClose={onClose} heightFraction={0.72}>
      <View style={af.header}>
        <Text style={af.title}>{editing ? 'Edit Account' : 'New Account'}</Text>
        <Pressable onPress={onClose} hitSlop={8}><Text style={af.cancel}>Cancel</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={af.content} keyboardShouldPersistTaps="handled">
        <View style={af.field}>
          <Text style={af.label}>NAME <Text style={{ color: C.neg }}>*</Text></Text>
          <TextInput
            style={af.input}
            value={form.name}
            onChangeText={(v) => setF('name', v)}
            placeholder="e.g. HDFC Savings"
            placeholderTextColor={C.ink3}
            autoFocus
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
              >
                <Text style={[af.chipText, form.type === t && { color: '#fff' }]}>{ACCOUNT_TYPE_LABELS[t]}</Text>
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
        </View>

        <Pressable
          style={[af.save, (!form.name.trim() || saving) && { opacity: 0.4 }]}
          onPress={handleSave}
          disabled={!form.name.trim() || saving}
        >
          <Text style={af.saveText}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Account'}</Text>
        </Pressable>
      </ScrollView>
    </Sheet>
  )
}

const af = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
  title: { fontSize: 20, fontFamily: F.semibold, color: C.ink },
  cancel: { fontSize: 14, fontFamily: F.regular, color: C.ink3 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: F.medium, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: F.regular, color: C.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg },
  chipText: { fontSize: 13.5, fontFamily: F.medium, color: C.ink2 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 10 },
  rupee: { fontSize: 14, fontFamily: F.medium, color: C.ink3 },
  amountInput: { flex: 1, fontSize: 14, fontFamily: F.mono, color: C.ink, padding: 0 },
  save: { backgroundColor: C.brand, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
})

// ─── Investment Sheet ──────────────────────────────────────────────────────────

function InvestmentSheet({
  visible, onClose, editing, onSaved,
}: {
  visible: boolean
  onClose: () => void
  editing: InvestmentWithTotal | null
  onSaved: (inv: InvestmentWithTotal) => void
}) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  React.useEffect(() => {
    if (visible) setName(editing?.name ?? '')
  }, [visible, editing])

  async function handleSave() {
    const n = name.trim()
    if (!n) return
    setSaving(true)
    try {
      if (editing) {
        const inv = await updateInvestment(editing.id, n)
        onSaved({ ...inv, total_invested: editing.total_invested })
      } else {
        const inv = await createInvestment(n)
        onSaved(inv)
      }
      onClose()
    } catch {
      Alert.alert('Error', 'Could not save investment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} heightFraction={0.45}>
      <View style={af.header}>
        <Text style={af.title}>{editing ? 'Edit Investment' : 'New Investment'}</Text>
        <Pressable onPress={onClose} hitSlop={8}><Text style={af.cancel}>Cancel</Text></Pressable>
      </View>
      <View style={{ padding: 16, gap: 16 }}>
        <View style={af.field}>
          <Text style={af.label}>NAME <Text style={{ color: C.neg }}>*</Text></Text>
          <TextInput
            style={af.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Zerodha, SBI PPF"
            placeholderTextColor={C.ink3}
            autoFocus
            onSubmitEditing={handleSave}
            returnKeyType="done"
          />
        </View>
        <Pressable
          style={[inv_s.save, (!name.trim() || saving) && { opacity: 0.4 }]}
          onPress={handleSave}
          disabled={!name.trim() || saving}
        >
          <Text style={inv_s.saveText}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Investment'}</Text>
        </Pressable>
      </View>
    </Sheet>
  )
}

const inv_s = StyleSheet.create({
  save: { backgroundColor: '#C99A2E', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
})

// ─── AccountsScreen ────────────────────────────────────────────────────────────

export function AccountsScreen() {
  const insets = useSafeAreaInsets()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [investments, setInvestments] = useState<InvestmentWithTotal[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Account sheet
  const [accSheetOpen, setAccSheetOpen] = useState(false)
  const [editingAcc, setEditingAcc] = useState<Account | null>(null)

  // Investment sheet
  const [invSheetOpen, setInvSheetOpen] = useState(false)
  const [editingInv, setEditingInv] = useState<InvestmentWithTotal | null>(null)

  const load = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const [accRes, invList] = await Promise.all([
        fetch(`${BASE}/api/mobile/accounts`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).then((r) => r.json() as Promise<Account[]>),
        listInvestments(),
      ])
      setAccounts(accRes)
      setInvestments(invList)
    } catch {
      // ignore
    }
  }, [])

  useFocusEffect(useCallback(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load]))

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    load().finally(() => setRefreshing(false))
  }, [load])

  const { totalBalance, bankCount, cardCount, totalInvested } = deriveAccountsSummary(accounts, investments)

  function openAddAcc() { setEditingAcc(null); setAccSheetOpen(true) }
  function openEditAcc(acc: Account) { setEditingAcc(acc); setAccSheetOpen(true) }

  function handleAccSaved(acc: Account) {
    setAccounts((prev) => {
      const idx = prev.findIndex((a) => a.id === acc.id)
      if (idx === -1) return [...prev, acc]
      const next = [...prev]; next[idx] = acc; return next
    })
  }

  async function handleDeleteAcc(acc: Account) {
    Alert.alert(`Delete "${acc.name}"?`, 'Transactions linked to this account will be unlinked but not deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteAccount(acc.id)
            setAccounts((prev) => prev.filter((a) => a.id !== acc.id))
          } catch {
            Alert.alert('Error', 'Could not delete account.')
          }
        },
      },
    ])
  }

  function openAddInv() { setEditingInv(null); setInvSheetOpen(true) }
  function openEditInv(inv: InvestmentWithTotal) { setEditingInv(inv); setInvSheetOpen(true) }

  function handleInvSaved(inv: InvestmentWithTotal) {
    setInvestments((prev) => {
      const idx = prev.findIndex((i) => i.id === inv.id)
      if (idx === -1) return [...prev, inv]
      const next = [...prev]; next[idx] = inv; return next
    })
  }

  async function handleDeleteInv(inv: InvestmentWithTotal) {
    Alert.alert(`Delete "${inv.name}"?`, 'Transactions linked to this investment will be unlinked but not deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteInvestment(inv.id)
            setInvestments((prev) => prev.filter((i) => i.id !== inv.id))
          } catch {
            Alert.alert('Error', 'Could not delete investment.')
          }
        },
      },
    ])
  }

  const EditIcon = () => (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
  )

  const TrashIcon = () => (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="3 6 5 6 21 6" />
      <Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <Path d="M10 11v6M14 11v6" />
    </Svg>
  )

  const ActionBtns = ({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) => (
    <View style={s.actionBtns}>
      <Pressable onPress={onEdit} style={s.iconBtn} hitSlop={4}><EditIcon /></Pressable>
      <Pressable onPress={onDelete} style={s.iconBtn} hitSlop={4}><TrashIcon /></Pressable>
    </View>
  )

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
      >
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <Text style={s.pageTitle}>Accounts</Text>
          <Pressable onPress={openAddAcc} style={s.addBtn}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <Path d="M12 5v14M5 12h14" />
            </Svg>
            <Text style={s.addBtnText}>Add</Text>
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
                <View style={s.listCard}>
                  {accounts.map((acc, idx) => {
                    const balColor = acc.current_balance >= 0 ? C.pos : C.neg
                    return (
                      <View key={acc.id} style={[s.listRow, idx < accounts.length - 1 && s.listRowBorder]}>
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
                        <ActionBtns onEdit={() => openEditAcc(acc)} onDelete={() => handleDeleteAcc(acc)} />
                      </View>
                    )
                  })}
                </View>
              </>
            )}

            {/* Investments section */}
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Investments</Text>
              <Pressable onPress={openAddInv} style={s.goldBtn}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                  <Path d="M12 5v14M5 12h14" />
                </Svg>
                <Text style={s.goldBtnText}>Add</Text>
              </Pressable>
            </View>

            {investments.length === 0 ? (
              <View style={s.emptyState}>
                <Svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <Polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                  <Polyline points="16 7 22 7 22 13" />
                </Svg>
                <Text style={s.emptyText}>No investments yet</Text>
                <Pressable onPress={openAddInv}><Text style={[s.emptyLink, { color: '#C99A2E' }]}>Add your first investment</Text></Pressable>
              </View>
            ) : (
              <>
                <InvHeroCard totalInvested={totalInvested} count={investments.length} />
                <View style={s.listCard}>
                  {investments.map((inv, idx) => (
                    <View key={inv.id} style={[s.listRow, idx < investments.length - 1 && s.listRowBorder]}>
                      <InvestmentIcon />
                      <View style={s.listInfo}>
                        <Text style={s.listName} numberOfLines={1}>{inv.name}</Text>
                        <Text style={s.listSub}>Investment</Text>
                      </View>
                      <Text style={[s.listBalance, { color: '#C99A2E' }]} numberOfLines={1}>
                        {formatAmount(inv.total_invested)}
                      </Text>
                      <ActionBtns onEdit={() => openEditInv(inv)} onDelete={() => handleDeleteInv(inv)} />
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
      />
      <InvestmentSheet
        visible={invSheetOpen}
        onClose={() => setInvSheetOpen(false)}
        editing={editingInv}
        onSaved={handleInvSaved}
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
  goldBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#C99A2E', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 8,
    shadowColor: '#C99A2E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  goldBtnText: { fontSize: 13.5, fontFamily: F.bold, color: '#fff' },
  loadingWrap: { paddingTop: 80, alignItems: 'center' },
  body: { paddingHorizontal: 18, paddingTop: 4, gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { fontSize: 17, fontFamily: F.extrabold, color: C.ink },
  listCard: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
    shadowColor: '#14281E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, paddingHorizontal: 16 },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  listInfo: { flex: 1, minWidth: 0 },
  listName: { fontSize: 14, fontFamily: F.semibold, color: C.ink },
  listSub: { fontSize: 12, fontFamily: F.regular, color: C.ink3, marginTop: 1 },
  listBalance: { fontSize: 14, fontFamily: F.monoBold, flexShrink: 0 },
  actionBtns: { flexDirection: 'row', gap: 2, flexShrink: 0 },
  iconBtn: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: F.regular, color: C.ink3 },
  emptyLink: { fontSize: 13, fontFamily: F.semibold, color: C.brand },
})
