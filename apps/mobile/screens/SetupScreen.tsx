import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { C, F, RADIUS } from '../lib/tokens'
import {
  setDisplayName,
  setEmail as saveEmail,
  setExpectedMonthlyIncome,
  addUpiId,
  markSetupComplete,
} from '../repositories/settingsRepository'
import { createAccount } from '../repositories/accountRepository'
import { listCategories, deleteCategory, createCategory } from '../repositories/categoryRepository'
import { normalizeUpiId } from '@paisa-buddy/shared/logic/upi'
import { useSetupComplete } from '../navigation'
import type { AccountType } from '@paisa-buddy/shared/types/account'
import { ACCOUNT_TYPE_LABELS } from '@paisa-buddy/shared/types/account'

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
type CatEntry = { name: string; color: string; selected: boolean }

const BANK_TYPES: AccountType[] = ['savings', 'current', 'credit']
const TOTAL_STEPS = 7
const INCOME_QUICK_PICKS = [
  { label: '₹25k', value: '25000' },
  { label: '₹50k', value: '50000' },
  { label: '₹85k', value: '85000' },
  { label: '₹1L', value: '100000' },
]

// ── Icons ────────────────────────────────────────────────────────────────────

function BuddySVG({ size = 64 }: { size?: number }) {
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

function SparkleIcon({ size = 16, color = '#E0A33C' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill={color}>
      <Path d="M8 0 L9.4 6.6 L16 8 L9.4 9.4 L8 16 L6.6 9.4 L0 8 L6.6 6.6 Z" />
    </Svg>
  )
}

function CheckIcon({ size = 16, color = C.brand }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="20 6 9 17 4 12" />
    </Svg>
  )
}

function ChevronLeft() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={C.ink2} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 18l-6-6 6-6" />
    </Svg>
  )
}

function ShieldCheckIcon({ size = 14, color = C.ink3 }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <Polyline points="9 12 11 14 15 10" />
    </Svg>
  )
}

function LockIcon({ size = 18, color = C.brand }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  )
}

function WifiOffIcon({ size = 18, color = C.brand }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 1l22 22" />
      <Path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <Path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <Path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <Path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <Path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <Circle cx="12" cy="20" r="1" fill={color} stroke="none" />
    </Svg>
  )
}

function PhoneIcon({ size = 18, color = C.brand }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <Circle cx="12" cy="17" r="1" fill={color} stroke="none" />
    </Svg>
  )
}

function SlidersIcon({ size = 18, color = C.brand }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 6h16M4 12h16M4 18h16" />
      <Circle cx="8" cy="6" r="2" fill={C.brandPale} stroke={color} strokeWidth="2" />
      <Circle cx="16" cy="12" r="2" fill={C.brandPale} stroke={color} strokeWidth="2" />
      <Circle cx="10" cy="18" r="2" fill={C.brandPale} stroke={color} strokeWidth="2" />
    </Svg>
  )
}

function BankIcon({ size = 20, color = C.brand }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 21h18M3 10h18M5 6l7-3 7 3M7 10v11M12 10v11M17 10v11" />
    </Svg>
  )
}

function WalletIcon({ size = 20, color = C.brand }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <Path d="M3 7v14a2 2 0 0 0 2 2h16v-5" />
      <Circle cx="18" cy="14" r="1" fill={color} stroke="none" />
    </Svg>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SegmentedProgressBar({ step }: { step: number }) {
  return (
    <View style={pb.row}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View key={i} style={[pb.seg, i < step ? pb.segFilled : pb.segEmpty]} />
      ))}
    </View>
  )
}
const pb = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, paddingHorizontal: 22, paddingTop: 14, paddingBottom: 6 },
  seg: { flex: 1, height: 5, borderRadius: 999 },
  segFilled: { backgroundColor: C.brand },
  segEmpty: { backgroundColor: '#E9ECE6' },
})

function IconTile({ children, active = false }: { children: React.ReactNode; active?: boolean }) {
  return (
    <View style={[it.wrap, active && it.wrapActive]}>
      {children}
    </View>
  )
}
const it = StyleSheet.create({
  wrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: C.brandPale, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  wrapActive: { backgroundColor: C.brand },
})

// ── Main component ────────────────────────────────────────────────────────────

export function SetupScreen() {
  const insets = useSafeAreaInsets()
  const onSetupComplete = useSetupComplete()
  const bottomPad = Math.max(insets.bottom, 16) + 24

  const [step, setStep] = useState<Step>(0)

  // Profile
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)

  // Income
  const [incomeInput, setIncomeInput] = useState('')

  // Account
  const [accountCategory, setAccountCategory] = useState<'bank' | 'cash'>('bank')
  const [accountType, setAccountType] = useState<AccountType>('savings')
  const [accountName, setAccountName] = useState('')
  const [bankName, setBankName] = useState('')
  const [balanceInput, setBalanceInput] = useState('')
  const [skipAccount, setSkipAccount] = useState(false)

  // UPI IDs
  const [upiInput, setUpiInput] = useState('')
  const [upiIds, setUpiIds] = useState<string[]>([])

  // Categories
  const [categories, setCategories] = useState<CatEntry[]>([])
  const [catsLoaded, setCatsLoaded] = useState(false)
  const [addingCustomCat, setAddingCustomCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [savingCat, setSavingCat] = useState(false)

  // General
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (step === 7 && !catsLoaded) {
      void listCategories().then((cats) => {
        setCategories(cats.map((c) => ({ name: c.name, color: c.color, selected: true })))
        setCatsLoaded(true)
      })
    }
  }, [step, catsLoaded])

  useEffect(() => {
    if (step !== 8) return
    const timer = setTimeout(() => { void handleFinish() }, 3000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  function goTo(s: Step) { setError(null); setStep(s) }
  function goBack() { if (step === 0 || step === 8) return; goTo((step - 1) as Step) }

  function pickAccountCategory(cat: 'bank' | 'cash') {
    setAccountCategory(cat)
    setAccountType(cat === 'cash' ? 'wallet' : 'savings')
  }

  function addUpiEntry() {
    const id = normalizeUpiId(upiInput)
    if (!id) return
    if (!upiIds.includes(id)) setUpiIds((prev) => [...prev, id])
    setUpiInput('')
  }

  function toggleCategory(catName: string) {
    setCategories((prev) => prev.map((c) => c.name === catName ? { ...c, selected: !c.selected } : c))
  }

  async function handleAddCustomCat() {
    const trimmed = newCatName.trim()
    if (!trimmed) return
    setSavingCat(true)
    try {
      const { name: n, color } = await createCategory(trimmed)
      setCategories((prev) => [...prev, { name: n, color, selected: true }])
      setNewCatName('')
      setAddingCustomCat(false)
    } finally {
      setSavingCat(false)
    }
  }

  function handleContinueProfile() {
    if (!name.trim()) { setError('Name is required.'); return }
    const trimmedEmail = email.trim()
    if (trimmedEmail && !/.+@.+\..+/.test(trimmedEmail)) {
      setEmailError('Enter a valid email address.')
      return
    }
    setEmailError(null); setError(null); goTo(3)
  }

  async function handleFinish() {
    if (saving) return
    setSaving(true); setError(null)
    try {
      const trimmedName = name.trim()
      if (trimmedName) await setDisplayName(trimmedName)
      const trimmedEmail = email.trim()
      if (trimmedEmail) await saveEmail(trimmedEmail)
      const rupees = parseInt(incomeInput.replace(/[^0-9]/g, ''), 10)
      await setExpectedMonthlyIncome(isNaN(rupees) || rupees <= 0 ? 0 : rupees * 100)
      if (!skipAccount && accountName.trim()) {
        const balR = parseInt(balanceInput.replace(/[^0-9]/g, ''), 10)
        await createAccount(accountName.trim(), accountType, bankName.trim() || null, isNaN(balR) || balR < 0 ? 0 : balR * 100)
      }
      for (const id of upiIds) await addUpiId(id)
      for (const cat of categories.filter((c) => !c.selected)) await deleteCategory(cat.name, false)
      await markSetupComplete()
      onSetupComplete()
    } catch {
      setError('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  // ── Step 0: Welcome ──────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={[s.welcomeScroll, { paddingBottom: Math.max(insets.bottom, 24) + 12 }]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Buddy + sparkle */}
          <View style={s.welcomeHero}>
            <View style={{ position: 'relative' }}>
              <BuddySVG size={104} />
              <View style={s.welcomeSparkle}>
                <SparkleIcon size={20} />
              </View>
            </View>
            <View style={s.wordmarkRow}>
              <Text style={s.wordmarkPaisa}>Paisa </Text>
              <Text style={s.wordmarkBuddy}>Buddy</Text>
            </View>
            <Text style={s.tagline}>Your money. Your device. 100% private.</Text>
          </View>

          {/* Value cards */}
          {(() => {
            const items = [
              { icon: <LockIcon />, title: 'No account required', sub: 'No sign-up, no password, no cloud.' },
              { icon: <WifiOffIcon />, title: 'Works fully offline', sub: 'Runs entirely on your device.' },
              { icon: <PhoneIcon />, title: 'Data never leaves your phone', sub: '100% local storage. Zero tracking.' },
            ]
            return (
              <View style={[s.groupCard, { marginBottom: 36 }]}>
                {items.map(({ icon, title, sub }, idx) => (
                  <View key={title} style={[s.groupRow, idx < items.length - 1 && s.groupRowBorder]}>
                    <IconTile>{icon}</IconTile>
                    <View style={{ flex: 1 }}>
                      <Text style={s.valueCardTitle}>{title}</Text>
                      <Text style={s.valueCardSub}>{sub}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )
          })()}

          <Pressable
            style={({ pressed }) => [s.btn, pressed && s.btnPress]}
            onPress={() => goTo(1)}
          >
            <Text style={s.btnText}>Let's Get Started</Text>
          </Pressable>

          <View style={s.welcomeFooter}>
            <ShieldCheckIcon size={13} />
            <Text style={s.welcomeFooterText}>All data stays on your device.</Text>
          </View>
        </ScrollView>
      </View>
    )
  }

  // ── Step 8: All Set ──────────────────────────────────────────────────────────
  if (step === 8) {
    return (
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={s.allSetWrap}>
          {/* Buddy in circle with sparkles */}
          <View style={s.allSetCircleWrap}>
            <View style={s.allSetCircle}>
              <BuddySVG size={96} />
            </View>
            <View style={[s.sparklePos, { top: 2, right: 14 }]}><SparkleIcon size={20} /></View>
            <View style={[s.sparklePos, { top: 32, left: 2 }]}><SparkleIcon size={12} /></View>
            <View style={[s.sparklePos, { bottom: 6, right: 2 }]}><SparkleIcon size={14} /></View>
          </View>

          <Text style={s.allSetTitle}>All done!</Text>
          <Text style={s.allSetSub}>
            Paisa Buddy is ready to help you{'\n'}manage your money better.
          </Text>

          {error && <Text style={[s.err, { textAlign: 'center', marginBottom: 8 }]}>{error}</Text>}

          <View style={s.settingUpRow}>
            <ActivityIndicator size="small" color={C.brand} />
            <Text style={s.settingUpText}>Setting up your dashboard…</Text>
          </View>
        </View>
      </View>
    )
  }

  // ── Steps 1–7: shared wrapper ────────────────────────────────────────────────
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <SegmentedProgressBar step={step} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: bottomPad }]}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back + step count */}
          <View style={s.navRow}>
            <Pressable style={s.backRow} onPress={goBack} hitSlop={8}>
              <ChevronLeft />
              <Text style={s.backBtn}>Back</Text>
            </Pressable>
            <Text style={s.stepCount}>{step} of {TOTAL_STEPS}</Text>
          </View>

          {/* ── Step 1: Privacy First ─────────────────────────────────────── */}
          {step === 1 && (
            <View>
              <View style={[s.privacyHero, { marginBottom: 28 }]}>
                <BuddySVG size={66} />
                <Text style={s.stepTitle}>Privacy first</Text>
                <Text style={s.stepSub}>
                  Paisa Buddy is built around one idea:{'\n'}your financial data belongs to you.
                </Text>
              </View>

              {(() => {
                const items = [
                  { icon: <WifiOffIcon />, label: 'Works Offline', sub: 'No internet needed after setup.' },
                  { icon: <PhoneIcon />, label: 'No Data Leaves Your Device', sub: 'Everything is stored locally on your phone.' },
                  { icon: <SlidersIcon />, label: "You're In Control", sub: 'Export or delete your data anytime.' },
                ]
                return (
                  <View style={s.groupCard}>
                    {items.map(({ icon, label, sub }, idx) => (
                      <View key={label} style={[s.groupRow, idx < items.length - 1 && s.groupRowBorder]}>
                        <IconTile>{icon}</IconTile>
                        <View style={{ flex: 1 }}>
                          <Text style={s.trustLabel}>{label}</Text>
                          <Text style={s.trustSub}>{sub}</Text>
                        </View>
                        <View style={s.trustCheck}><CheckIcon /></View>
                      </View>
                    ))}
                  </View>
                )
              })()}

              <Pressable style={({ pressed }) => [s.btn, { marginTop: 28 }, pressed && s.btnPress]} onPress={() => goTo(2)}>
                <Text style={s.btnText}>Continue</Text>
              </Pressable>
            </View>
          )}

          {/* ── Step 2: Profile ───────────────────────────────────────────── */}
          {step === 2 && (
            <View>
              <Text style={s.stepTitle}>What should we{'\n'}call you?</Text>
              <Text style={s.stepSub}>
                Your name helps identify you as sender or receiver in uploaded receipts.
              </Text>

              <View style={[s.field, { marginTop: 28 }]}>
                <Text style={s.fieldLabel}>Full Name</Text>
                <View style={s.inputBox}>
                  <TextInput
                    style={s.input}
                    placeholder="e.g. Rahul Sharma"
                    placeholderTextColor={C.ink3}
                    value={name}
                    onChangeText={(t) => { setName(t); setError(null) }}
                    autoCapitalize="words"
                    returnKeyType="next"
                    autoFocus
                  />
                </View>
                {error && <Text style={s.err}>{error}</Text>}
              </View>

              {/* Tip card */}
              <View style={s.tipCard}>
                <BuddySVG size={28} />
                <Text style={s.tipText}>Your name is stored only on this device. It never leaves your phone.</Text>
              </View>

              <View style={s.field}>
                <Text style={s.fieldLabel}>Email <Text style={s.optional}>(Optional)</Text></Text>
                <View style={s.inputBox}>
                  <TextInput
                    style={s.input}
                    placeholder="you@example.com"
                    placeholderTextColor={C.ink3}
                    value={email}
                    onChangeText={(t) => { setEmail(t); setEmailError(null) }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleContinueProfile}
                  />
                </View>
                {emailError
                  ? <Text style={s.err}>{emailError}</Text>
                  : <Text style={s.hint}>Optional. Stored only on your device.</Text>}
              </View>

              <Pressable style={({ pressed }) => [s.btn, { marginTop: 8 }, pressed && s.btnPress]} onPress={handleContinueProfile}>
                <Text style={s.btnText}>Continue</Text>
              </Pressable>
            </View>
          )}

          {/* ── Step 3: Monthly Income ────────────────────────────────────── */}
          {step === 3 && (
            <View>
              <Text style={s.stepTitle}>Monthly Income</Text>
              <Text style={s.stepSub}>
                Used to track spending progress and calculate what's left each month.
              </Text>

              <View style={[s.field, { marginTop: 28 }]}>
                <Text style={s.fieldLabel}>Expected Monthly Income</Text>
                <View style={s.incomeField}>
                  <Text style={s.incomePrefix}>₹</Text>
                  <TextInput
                    style={s.incomeInput}
                    placeholder="0"
                    placeholderTextColor={C.ink3}
                    value={incomeInput ? Number(incomeInput).toLocaleString('en-IN') : ''}
                    onChangeText={(t) => setIncomeInput(t.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    returnKeyType="done"
                    autoFocus
                  />
                </View>

                {/* Quick picks */}
                <View style={s.quickPicks}>
                  {INCOME_QUICK_PICKS.map(({ label, value }) => (
                    <Pressable
                      key={value}
                      style={[s.quickChip, incomeInput === value && s.quickChipActive]}
                      onPress={() => setIncomeInput(value)}
                    >
                      <Text style={[s.quickChipText, incomeInput === value && s.quickChipTextActive]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable style={({ pressed }) => [s.btn, { marginTop: 8 }, pressed && s.btnPress]} onPress={() => goTo(4)}>
                <Text style={s.btnText}>Continue</Text>
              </Pressable>

              <Pressable style={s.skipBtn} onPress={() => goTo(4)}>
                <Text style={s.skipText}>Skip — I'll add this later</Text>
              </Pressable>

              <Text style={[s.hint, { textAlign: 'center' }]}>
                Skipping will make monthly spending insights less accurate.
              </Text>
            </View>
          )}

          {/* ── Step 4: Account Type ──────────────────────────────────────── */}
          {step === 4 && (
            <View>
              <Text style={s.stepTitle}>Add your first{'\n'}account</Text>
              <Text style={s.stepSub}>Choose the type of account you use most often.</Text>

              <View style={[s.optionCards, { marginTop: 28 }]}>
                {([
                  { cat: 'bank' as const, icon: <BankIcon size={20} color={accountCategory === 'bank' ? '#fff' : C.brand} />, title: 'Bank Account', sub: 'Savings, Current, Credit Card' },
                  { cat: 'cash' as const, icon: <WalletIcon size={20} color={accountCategory === 'cash' ? '#fff' : C.brand} />, title: 'Cash / Wallet', sub: 'Physical cash, UPI wallet, Petty cash' },
                ]).map(({ cat, icon, title, sub }) => {
                  const active = accountCategory === cat
                  return (
                    <Pressable key={cat} style={[s.optionCard, active && s.optionCardActive]} onPress={() => pickAccountCategory(cat)}>
                      <IconTile active={active}>{icon}</IconTile>
                      <View style={s.optionCardBody}>
                        <Text style={[s.optionCardTitle, active && s.optionCardTitleActive]}>{title}</Text>
                        <Text style={s.optionCardSub}>{sub}</Text>
                      </View>
                      <View style={[s.radioCircle, active && s.radioCircleActive]}>
                        {active && <CheckIcon size={13} color="#fff" />}
                      </View>
                    </Pressable>
                  )
                })}
              </View>

              <Pressable style={({ pressed }) => [s.btn, { marginTop: 28 }, pressed && s.btnPress]} onPress={() => goTo(5)}>
                <Text style={s.btnText}>Continue</Text>
              </Pressable>
            </View>
          )}

          {/* ── Step 5: Account Details ───────────────────────────────────── */}
          {step === 5 && (
            <View>
              <Text style={s.stepTitle}>Account details</Text>
              <Text style={s.stepSub}>You can add more accounts anytime from the Accounts screen.</Text>

              <View style={[s.field, { marginTop: 28 }]}>
                <Text style={s.fieldLabel}>Account Name</Text>
                <View style={s.inputBox}>
                  <TextInput
                    style={s.input}
                    placeholder={accountCategory === 'bank' ? 'e.g. SBI Savings, HDFC CC' : 'e.g. Cash, PhonePe Wallet'}
                    placeholderTextColor={C.ink3}
                    value={accountName}
                    onChangeText={(t) => { setAccountName(t); setError(null) }}
                    returnKeyType="next"
                    autoFocus
                  />
                </View>
              </View>

              {accountCategory === 'bank' && (
                <>
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Account Type</Text>
                    <View style={s.segmented}>
                      {BANK_TYPES.map((t, idx) => (
                        <Pressable
                          key={t}
                          style={[
                            s.segment,
                            accountType === t && s.segmentActive,
                            idx < BANK_TYPES.length - 1 && s.segmentBorder,
                          ]}
                          onPress={() => setAccountType(t)}
                        >
                          <Text style={[s.segmentText, accountType === t && s.segmentTextActive]}>
                            {ACCOUNT_TYPE_LABELS[t]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Bank Name <Text style={s.optional}>(Optional)</Text></Text>
                    <View style={s.inputBox}>
                      <TextInput
                        style={s.input}
                        placeholder="e.g. SBI, HDFC, ICICI"
                        placeholderTextColor={C.ink3}
                        value={bankName}
                        onChangeText={setBankName}
                        returnKeyType="next"
                      />
                    </View>
                  </View>
                </>
              )}

              <View style={s.field}>
                <Text style={s.fieldLabel}>Opening Balance <Text style={s.optional}>(Optional)</Text></Text>
                <View style={[s.inputBox, s.inputBoxRow]}>
                  <Text style={s.rupeePrefix}>₹</Text>
                  <TextInput
                    style={s.input}
                    placeholder="0"
                    placeholderTextColor={C.ink3}
                    value={balanceInput}
                    onChangeText={(t) => setBalanceInput(t.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    returnKeyType="done"
                  />
                </View>
              </View>

              {error && <Text style={s.err}>{error}</Text>}

              <Pressable
                style={({ pressed }) => [s.btn, { marginTop: 8 }, !accountName.trim() && s.btnOff, pressed && s.btnPress]}
                onPress={() => {
                  if (!accountName.trim()) { setError('Account name is required.'); return }
                  setSkipAccount(false); goTo(6)
                }}
                disabled={!accountName.trim()}
              >
                <Text style={s.btnText}>Continue</Text>
              </Pressable>

              <Pressable style={s.skipBtn} onPress={() => { setSkipAccount(true); goTo(6) }}>
                <Text style={s.skipText}>Skip account setup</Text>
              </Pressable>
            </View>
          )}

          {/* ── Step 6: UPI IDs ───────────────────────────────────────────── */}
          {step === 6 && (
            <View>
              <Text style={s.stepTitle}>Your UPI IDs</Text>
              <Text style={s.stepSub}>
                Helps identify debit and credit direction in uploaded statements.
              </Text>

              <View style={[s.field, { marginTop: 28 }]}>
                <Text style={s.fieldLabel}>Add UPI ID</Text>
                <View style={[s.inputBox, s.inputBoxRow]}>
                  <TextInput
                    style={[s.input, { fontFamily: F.mono }]}
                    placeholder="yourname@upi"
                    placeholderTextColor={C.ink3}
                    value={upiInput}
                    onChangeText={setUpiInput}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={addUpiEntry}
                  />
                  <Pressable onPress={addUpiEntry} disabled={!upiInput.trim()} hitSlop={8}>
                    <Text style={[s.addAction, !upiInput.trim() && { opacity: 0.35 }]}>Add</Text>
                  </Pressable>
                </View>
              </View>

              {upiIds.length > 0 && (
                <View style={s.upiChips}>
                  {upiIds.map((id) => (
                    <View key={id} style={s.upiChip}>
                      <Text style={s.upiChipText} numberOfLines={1}>{id}</Text>
                      <Pressable onPress={() => setUpiIds((p) => p.filter((u) => u !== id))} hitSlop={8} style={s.upiChipX}>
                        <Text style={s.upiChipXText}>×</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              <Pressable style={({ pressed }) => [s.btn, { marginTop: 28 }, pressed && s.btnPress]} onPress={() => goTo(7)}>
                <Text style={s.btnText}>Continue</Text>
              </Pressable>

              <Pressable style={s.skipBtn} onPress={() => goTo(7)}>
                <Text style={s.skipText}>Skip — I'll add UPI IDs later</Text>
              </Pressable>
            </View>
          )}

          {/* ── Step 7: Categories ────────────────────────────────────────── */}
          {step === 7 && (
            <View>
              <Text style={s.stepTitle}>Your categories</Text>
              <Text style={s.stepSub}>Tap to turn any off. You can change these anytime in Settings.</Text>

              {!catsLoaded ? (
                <View style={s.catsLoading}>
                  <ActivityIndicator color={C.brand} />
                </View>
              ) : (
                <>
                  <View style={[s.catGrid, { marginTop: 28 }]}>
                    {categories.map((cat) => (
                      <Pressable
                        key={cat.name}
                        style={[s.catChip, cat.selected ? s.catChipActive : s.catChipOff]}
                        onPress={() => toggleCategory(cat.name)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: cat.selected }}
                      >
                        <View style={[s.catDot, { backgroundColor: cat.selected ? cat.color : C.ink3 }]} />
                        <Text style={[s.catChipText, cat.selected && s.catChipTextActive]}>
                          {cat.name}
                        </Text>
                      </Pressable>
                    ))}

                    {!addingCustomCat && (
                      <Pressable style={s.catAddChip} onPress={() => setAddingCustomCat(true)}>
                        <Text style={s.catAddText}>+ Add custom</Text>
                      </Pressable>
                    )}
                  </View>

                  {addingCustomCat && (
                    <View style={[s.inputBox, s.inputBoxRow, { marginTop: 14 }]}>
                      <TextInput
                        style={s.input}
                        placeholder="Category name"
                        placeholderTextColor={C.ink3}
                        value={newCatName}
                        onChangeText={setNewCatName}
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={() => void handleAddCustomCat()}
                      />
                      <Pressable onPress={() => void handleAddCustomCat()} disabled={!newCatName.trim() || savingCat} hitSlop={8}>
                        {savingCat
                          ? <ActivityIndicator size="small" color={C.brand} />
                          : <Text style={[s.addAction, !newCatName.trim() && { opacity: 0.35 }]}>Add</Text>}
                      </Pressable>
                      <Pressable onPress={() => { setAddingCustomCat(false); setNewCatName('') }} hitSlop={8}>
                        <Text style={s.cancelText}>Cancel</Text>
                      </Pressable>
                    </View>
                  )}
                </>
              )}

              <Pressable
                style={({ pressed }) => [s.btn, { marginTop: 24 }, !catsLoaded && s.btnOff, pressed && s.btnPress]}
                onPress={() => goTo(8)}
                disabled={!catsLoaded}
              >
                <Text style={s.btnText}>Continue</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 22, paddingTop: 8 },

  // Nav
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, marginBottom: 28 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backBtn: { fontSize: 15, fontFamily: F.bold, color: C.ink2 },
  stepCount: { fontSize: 13.5, fontFamily: F.bold, color: C.ink3 },

  // Welcome
  welcomeScroll: { paddingHorizontal: 22, flexGrow: 1, justifyContent: 'center' },
  welcomeHero: { alignItems: 'center', marginBottom: 36 },
  welcomeSparkle: { position: 'absolute', top: -4, right: -8 },
  wordmarkRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 18 },
  wordmarkPaisa: { fontSize: 27, fontFamily: F.extrabold, letterSpacing: -0.5, color: C.ink },
  wordmarkBuddy: { fontSize: 27, fontFamily: F.extrabold, letterSpacing: -0.5, color: C.brand },
  tagline: { fontSize: 14, fontFamily: F.medium, color: C.ink3, marginTop: 8, textAlign: 'center' },
  groupCard: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
    shadowColor: '#142819', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  groupRowBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  valueCardTitle: { fontSize: 14, fontFamily: F.semibold, color: C.ink, marginBottom: 2 },
  valueCardSub: { fontSize: 12, fontFamily: F.regular, color: C.ink3, lineHeight: 17 },
  welcomeFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 16 },
  welcomeFooterText: { fontSize: 12, fontFamily: F.regular, color: C.ink3 },

  // All Set
  allSetWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  allSetCircleWrap: { position: 'relative', width: 164, height: 164, marginBottom: 28 },
  allSetCircle: { width: 164, height: 164, borderRadius: 82, backgroundColor: C.brandPale, alignItems: 'center', justifyContent: 'center' },
  sparklePos: { position: 'absolute' },
  allSetTitle: { fontSize: 34, fontFamily: F.extrabold, color: C.ink, marginBottom: 10, textAlign: 'center' },
  allSetSub: { fontSize: 15, fontFamily: F.medium, color: C.ink3, textAlign: 'center', lineHeight: 23 },
  settingUpRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 32 },
  settingUpText: { fontSize: 14, fontFamily: F.medium, color: C.ink3 },

  // Step hero (privacy)
  privacyHero: { alignItems: 'center' },
  stepTitle: { fontSize: 28, fontFamily: F.extrabold, color: C.ink, marginBottom: 8, lineHeight: 34, letterSpacing: -0.5 },
  stepSub: { fontSize: 14, fontFamily: F.medium, color: C.ink3, lineHeight: 21 },

  // Trust cards (Privacy step)
  trustCheck: { marginLeft: 4 },
  trustLabel: { fontSize: 14, fontFamily: F.semibold, color: C.ink, marginBottom: 2 },
  trustSub: { fontSize: 12, fontFamily: F.regular, color: C.ink3, lineHeight: 17 },

  // Profile tip card
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.brandPale,
    borderRadius: RADIUS,
    padding: 14,
    marginBottom: 18,
  },
  tipText: { flex: 1, fontSize: 12.5, fontFamily: F.regular, color: C.ink2, lineHeight: 18 },

  // Form
  field: { marginBottom: 18 },
  fieldLabel: { fontSize: 11, fontFamily: F.bold, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  optional: { fontFamily: F.regular, textTransform: 'none', letterSpacing: 0, fontSize: 11 },
  inputBox: { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  inputBoxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, fontSize: 15, fontFamily: F.regular, color: C.ink, padding: 0 },
  rupeePrefix: { fontSize: 15, fontFamily: F.regular, color: C.ink3, flexShrink: 0 },
  hint: { fontSize: 11.5, fontFamily: F.regular, color: C.ink3, marginTop: 6, lineHeight: 18 },

  // Income big field
  incomeField: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16 },
  incomePrefix: { fontSize: 28, fontFamily: F.extrabold, color: C.ink3, marginRight: 6 },
  incomeInput: { flex: 1, fontSize: 28, fontFamily: F.monoBold, color: C.ink, padding: 0 },

  // Quick picks (income)
  quickPicks: { flexDirection: 'row', gap: 8, marginTop: 12 },
  quickChip: { flex: 1, paddingVertical: 9, borderRadius: 99, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.surface, alignItems: 'center' },
  quickChipActive: { borderColor: C.brand, backgroundColor: C.brandPale },
  quickChipText: { fontSize: 13, fontFamily: F.semibold, color: C.ink3 },
  quickChipTextActive: { color: C.brand },

  // Option cards (account type step 4)
  optionCards: { gap: 12 },
  optionCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surface, borderRadius: RADIUS, borderWidth: 1.5, borderColor: C.line, padding: 18 },
  optionCardActive: { borderColor: C.brand, backgroundColor: C.brandPale },
  optionCardBody: { flex: 1 },
  optionCardTitle: { fontSize: 15, fontFamily: F.semibold, color: C.ink, marginBottom: 2 },
  optionCardTitleActive: { color: C.brand },
  optionCardSub: { fontSize: 12, fontFamily: F.regular, color: C.ink3 },
  radioCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  radioCircleActive: { backgroundColor: C.brand, borderColor: C.brand },

  // Segmented control (account details step 5)
  segmented: { flexDirection: 'row', backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.line, borderRadius: RADIUS, overflow: 'hidden' },
  segment: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  segmentBorder: { borderRightWidth: 1, borderRightColor: C.line },
  segmentActive: { backgroundColor: C.brandPale },
  segmentText: { fontSize: 13, fontFamily: F.medium, color: C.ink3 },
  segmentTextActive: { color: C.brand, fontFamily: F.semibold },

  // UPI chips (step 6)
  upiChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  upiChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 12, paddingRight: 4, paddingVertical: 7, borderRadius: 99, borderWidth: 1.5, borderColor: C.brand, backgroundColor: C.brandPale },
  upiChipText: { fontSize: 13, fontFamily: F.mono, color: C.brand, maxWidth: 180 },
  upiChipX: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  upiChipXText: { fontSize: 18, fontFamily: F.regular, color: C.brand, lineHeight: 22 },
  addAction: { fontSize: 13, fontFamily: F.bold, color: C.brand },

  // Categories (step 7)
  catsLoading: { paddingVertical: 48, alignItems: 'center' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 99, borderWidth: 1.5 },
  catChipActive: { borderColor: C.brand, backgroundColor: C.brandPale },
  catChipOff: { borderColor: C.line, backgroundColor: C.surface, opacity: 0.6 },
  catDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  catChipText: { fontSize: 13, fontFamily: F.medium, color: C.ink3 },
  catChipTextActive: { color: C.ink, fontFamily: F.semibold },
  catAddChip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 99, borderWidth: 1.5, borderColor: C.brand, borderStyle: 'dashed' },
  catAddText: { fontSize: 13, fontFamily: F.semibold, color: C.brand },
  cancelText: { fontSize: 13, fontFamily: F.regular, color: C.ink3, marginLeft: 4 },

  // Buttons
  btn: { backgroundColor: C.brand, borderRadius: RADIUS, paddingVertical: 16, alignItems: 'center', height: 54, justifyContent: 'center', shadowColor: C.brand, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  btnOff: { opacity: 0.45 },
  btnPress: { opacity: 0.85 },
  btnText: { color: '#ffffff', fontSize: 16, fontFamily: F.bold },
  skipBtn: { alignItems: 'center', paddingVertical: 14 },
  skipText: { fontSize: 14, fontFamily: F.regular, color: C.ink3 },

  err: { fontSize: 12, fontFamily: F.regular, color: C.neg, marginTop: 6 },
})
