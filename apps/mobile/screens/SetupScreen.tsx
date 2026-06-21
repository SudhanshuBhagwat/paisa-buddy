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
import Svg, { Circle, Path, Polyline } from 'react-native-svg'
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
import { listCategories, deleteCategory } from '../repositories/categoryRepository'
import { normalizeUpiId } from '@paisa-buddy/shared/logic/upi'
import { useSetupComplete } from '../navigation'
import type { AccountType } from '@paisa-buddy/shared/types/account'
import { ACCOUNT_TYPE_LABELS } from '@paisa-buddy/shared/types/account'

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

type CatEntry = { name: string; color: string; selected: boolean }

const BANK_TYPES: AccountType[] = ['savings', 'current', 'credit']
const TOTAL_STEPS = 7

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

function CheckIcon({ color = C.brand }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="20 6 9 17 4 12" />
    </Svg>
  )
}

export function SetupScreen() {
  const insets = useSafeAreaInsets()
  const onSetupComplete = useSetupComplete()
  const bottomPad = Math.max(insets.bottom, 16) + 20

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

  function goTo(s: Step) {
    setError(null)
    setStep(s)
  }

  function goBack() {
    if (step === 0 || step === 8) return
    goTo((step - 1) as Step)
  }

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

  function removeUpiEntry(id: string) {
    setUpiIds((prev) => prev.filter((u) => u !== id))
  }

  function toggleCategory(name: string) {
    setCategories((prev) =>
      prev.map((c) => (c.name === name ? { ...c, selected: !c.selected } : c))
    )
  }

  function handleContinueProfile() {
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    const trimmedEmail = email.trim()
    if (trimmedEmail && !/.+@.+\..+/.test(trimmedEmail)) {
      setEmailError('Enter a valid email address.')
      return
    }
    setEmailError(null)
    setError(null)
    goTo(3)
  }

  async function handleFinish() {
    setSaving(true)
    setError(null)
    try {
      const trimmedName = name.trim()
      if (trimmedName) await setDisplayName(trimmedName)

      const trimmedEmail = email.trim()
      if (trimmedEmail) await saveEmail(trimmedEmail)

      const rupees = parseInt(incomeInput.replace(/[^0-9]/g, ''), 10)
      const incomePaise = isNaN(rupees) || rupees <= 0 ? 0 : rupees * 100
      await setExpectedMonthlyIncome(incomePaise)

      if (!skipAccount && accountName.trim()) {
        const balRupees = parseInt(balanceInput.replace(/[^0-9]/g, ''), 10)
        const balPaise = isNaN(balRupees) || balRupees < 0 ? 0 : balRupees * 100
        await createAccount(accountName.trim(), accountType, bankName.trim() || null, balPaise)
      }

      for (const id of upiIds) {
        await addUpiId(id)
      }

      for (const cat of categories.filter((c) => !c.selected)) {
        await deleteCategory(cat.name, false)
      }

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
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={s.welcomeWrap}>
          <View style={s.hero}>
            <BuddySVG size={88} />
            <View style={s.wordmarkRow}>
              <Text style={s.wordmarkPaisa}>Paisa </Text>
              <Text style={s.wordmarkBuddy}>Buddy</Text>
            </View>
            <Text style={s.tagline}>Your money. Your device. 100% private.</Text>
          </View>

          <View style={s.bullets}>
            {[
              'No login required',
              'Works fully offline',
              'Data never leaves your device',
            ].map((label) => (
              <View key={label} style={s.bulletRow}>
                <View style={s.bulletDot} />
                <Text style={s.bulletText}>{label}</Text>
              </View>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [s.btn, pressed && s.btnPress]}
            onPress={() => goTo(1)}
          >
            <Text style={s.btnText}>Let's Get Started</Text>
          </Pressable>

          <Text style={s.welcomeFooter}>All data stays on your device.</Text>
        </View>
      </View>
    )
  }

  // ── Step 8: All Set ──────────────────────────────────────────────────────────
  if (step === 8) {
    return (
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={s.welcomeWrap}>
          <View style={s.hero}>
            <BuddySVG size={88} />
            <Text style={s.allSetTitle}>All done!</Text>
            <Text style={s.allSetSub}>
              Paisa Buddy is ready to help you{'\n'}manage your money better.
            </Text>
          </View>

          {error && <Text style={[s.err, { textAlign: 'center', marginBottom: 16 }]}>{error}</Text>}

          <ActivityIndicator color={C.brand} style={{ marginTop: 8 }} />
        </View>
      </View>
    )
  }

  // ── Steps 1–7: shared wrapper with progress bar ──────────────────────────────
  const progressPct = `${Math.round((step / TOTAL_STEPS) * 100)}%`

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Progress bar */}
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: progressPct }]} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: bottomPad }]}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back + step count */}
          <View style={s.navRow}>
            <Pressable onPress={goBack} hitSlop={8}>
              <Text style={s.backBtn}>Back</Text>
            </Pressable>
            <Text style={s.stepCount}>{step} of {TOTAL_STEPS}</Text>
          </View>

          {/* ── Step 1: Privacy First ─────────────────────────────────────── */}
          {step === 1 && (
            <View>
              <View style={[s.hero, { marginBottom: 32 }]}>
                <BuddySVG size={64} />
                <Text style={s.stepTitle}>Privacy First</Text>
                <Text style={s.stepSub}>
                  Paisa Buddy is built around one idea:{'\n'}your financial data belongs to you.
                </Text>
              </View>

              <View style={s.trustCards}>
                {[
                  { label: 'Works Offline', sub: 'No internet connection needed after setup.' },
                  { label: 'No Data Leaves Your Device', sub: 'Everything is stored locally on your phone.' },
                  { label: "You're In Control", sub: 'Export or delete your data anytime.' },
                ].map(({ label, sub }) => (
                  <View key={label} style={s.trustCard}>
                    <View style={s.trustCheck}><CheckIcon /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.trustLabel}>{label}</Text>
                      <Text style={s.trustSub}>{sub}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <Pressable
                style={({ pressed }) => [s.btn, { marginTop: 32 }, pressed && s.btnPress]}
                onPress={() => goTo(2)}
              >
                <Text style={s.btnText}>Continue</Text>
              </Pressable>
            </View>
          )}

          {/* ── Step 2: Profile ───────────────────────────────────────────── */}
          {step === 2 && (
            <View>
              <Text style={s.stepTitle}>What should we{'\n'}call you?</Text>
              <Text style={s.stepSub}>
                Your name helps personalize Paisa Buddy and identify you in uploaded receipts.
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
                  : <Text style={s.hint}>Optional and only stored on your device.</Text>}
              </View>

              <Pressable
                style={({ pressed }) => [s.btn, { marginTop: 8 }, pressed && s.btnPress]}
                onPress={handleContinueProfile}
              >
                <Text style={s.btnText}>Continue</Text>
              </Pressable>
            </View>
          )}

          {/* ── Step 3: Monthly Income ────────────────────────────────────── */}
          {step === 3 && (
            <View>
              <Text style={s.stepTitle}>Monthly Income</Text>
              <Text style={s.stepSub}>
                Used to track spending progress and calculate how much is left each month.
              </Text>

              <View style={[s.field, { marginTop: 28 }]}>
                <Text style={s.fieldLabel}>Expected Monthly Income</Text>
                <View style={[s.inputBox, s.inputBoxRow]}>
                  <Text style={s.rupeePrefix}>₹</Text>
                  <TextInput
                    style={s.input}
                    placeholder="e.g. 85000"
                    placeholderTextColor={C.ink3}
                    value={incomeInput}
                    onChangeText={(t) => setIncomeInput(t.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    returnKeyType="done"
                    autoFocus
                  />
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [s.btn, { marginTop: 8 }, pressed && s.btnPress]}
                onPress={() => goTo(4)}
              >
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

              <View style={[s.typeCards, { marginTop: 28 }]}>
                <Pressable
                  style={[s.typeCard, accountCategory === 'bank' && s.typeCardActive]}
                  onPress={() => pickAccountCategory('bank')}
                >
                  <View style={s.typeCardBody}>
                    <Text style={[s.typeCardTitle, accountCategory === 'bank' && s.typeCardTitleActive]}>
                      Bank Account
                    </Text>
                    <Text style={s.typeCardSub}>Savings, Current, Credit Card</Text>
                  </View>
                  {accountCategory === 'bank' && (
                    <View style={s.typeCardCheck}><CheckIcon /></View>
                  )}
                </Pressable>

                <Pressable
                  style={[s.typeCard, accountCategory === 'cash' && s.typeCardActive]}
                  onPress={() => pickAccountCategory('cash')}
                >
                  <View style={s.typeCardBody}>
                    <Text style={[s.typeCardTitle, accountCategory === 'cash' && s.typeCardTitleActive]}>
                      Cash / Wallet
                    </Text>
                    <Text style={s.typeCardSub}>Physical cash, UPI wallet, Petty cash</Text>
                  </View>
                  {accountCategory === 'cash' && (
                    <View style={s.typeCardCheck}><CheckIcon /></View>
                  )}
                </Pressable>
              </View>

              <Pressable
                style={({ pressed }) => [s.btn, { marginTop: 32 }, pressed && s.btnPress]}
                onPress={() => goTo(5)}
              >
                <Text style={s.btnText}>Continue</Text>
              </Pressable>
            </View>
          )}

          {/* ── Step 5: Account Details ───────────────────────────────────── */}
          {step === 5 && (
            <View>
              <Text style={s.stepTitle}>Account details</Text>
              <Text style={s.stepSub}>You can add more accounts anytime in the Accounts screen.</Text>

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
                    <View style={s.chipRow}>
                      {BANK_TYPES.map((t) => (
                        <Pressable
                          key={t}
                          style={[s.chip, accountType === t && s.chipActive]}
                          onPress={() => setAccountType(t)}
                        >
                          <Text style={[s.chipText, accountType === t && s.chipTextActive]}>
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
                  if (!accountName.trim()) {
                    setError('Account name is required.')
                    return
                  }
                  setSkipAccount(false)
                  goTo(6)
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
                UPI IDs help Paisa Buddy identify debit and credit direction in uploaded statements.
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
                  <Pressable
                    onPress={addUpiEntry}
                    disabled={!upiInput.trim()}
                    hitSlop={8}
                  >
                    <Text style={[s.addAction, !upiInput.trim() && { opacity: 0.35 }]}>Add</Text>
                  </Pressable>
                </View>
              </View>

              {upiIds.length > 0 && (
                <View style={s.upiList}>
                  {upiIds.map((id) => (
                    <View key={id} style={s.upiRow}>
                      <Text style={s.upiId} numberOfLines={1}>{id}</Text>
                      <Pressable onPress={() => removeUpiEntry(id)} hitSlop={8}>
                        <Text style={s.removeText}>Remove</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              <Pressable
                style={({ pressed }) => [s.btn, { marginTop: 28 }, pressed && s.btnPress]}
                onPress={() => goTo(7)}
              >
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
              <Text style={s.stepSub}>
                These are your default spending categories. Deselect any you don't need.
              </Text>

              {!catsLoaded ? (
                <View style={s.catsLoading}>
                  <ActivityIndicator color={C.brand} />
                </View>
              ) : (
                <View style={[s.catGrid, { marginTop: 28 }]}>
                  {categories.map((cat) => (
                    <Pressable
                      key={cat.name}
                      style={[s.catChip, cat.selected && s.catChipActive]}
                      onPress={() => toggleCategory(cat.name)}
                    >
                      <View style={[s.catDot, { backgroundColor: cat.selected ? cat.color : C.ink3 }]} />
                      <Text style={[s.catChipText, cat.selected && s.catChipTextActive]}>
                        {cat.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={[s.hint, { marginTop: 16 }]}>
                You can add or remove categories anytime in Settings.
              </Text>

              <Pressable
                style={({ pressed }) => [s.btn, { marginTop: 20 }, !catsLoaded && s.btnOff, pressed && s.btnPress]}
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
  scroll: { paddingHorizontal: 24, paddingTop: 12 },

  // Progress
  progressTrack: { height: 3, backgroundColor: C.line },
  progressFill: { height: 3, backgroundColor: C.brand },

  // Nav
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    marginBottom: 32,
  },
  backBtn: { fontSize: 14, fontFamily: F.semibold, color: C.ink3 },
  stepCount: { fontSize: 12, fontFamily: F.regular, color: C.ink3 },

  // Welcome
  welcomeWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 20 },
  hero: { alignItems: 'center', marginBottom: 40 },
  wordmarkRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 16 },
  wordmarkPaisa: { fontSize: 26, fontFamily: F.extrabold, letterSpacing: -0.5, color: C.ink },
  wordmarkBuddy: { fontSize: 26, fontFamily: F.extrabold, letterSpacing: -0.5, color: C.brand },
  tagline: { fontSize: 14, fontFamily: F.regular, color: C.ink3, marginTop: 8, textAlign: 'center' },
  bullets: { gap: 14, marginBottom: 44 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.brand, marginTop: 5, flexShrink: 0 },
  bulletText: { fontSize: 14, fontFamily: F.regular, color: C.ink2, flex: 1 },
  welcomeFooter: { fontSize: 12, fontFamily: F.regular, color: C.ink3, textAlign: 'center', marginTop: 16 },

  // All Set
  allSetTitle: { fontSize: 28, fontFamily: F.extrabold, color: C.ink, marginTop: 20, marginBottom: 8 },
  allSetSub: { fontSize: 14, fontFamily: F.regular, color: C.ink3, textAlign: 'center', lineHeight: 22 },

  // Step hero
  stepTitle: { fontSize: 26, fontFamily: F.extrabold, color: C.ink, marginBottom: 8, lineHeight: 34 },
  stepSub: { fontSize: 13, fontFamily: F.regular, color: C.ink3, lineHeight: 20 },

  // Trust cards (Privacy step)
  trustCards: { gap: 10 },
  trustCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
  },
  trustCheck: { marginTop: 1 },
  trustLabel: { fontSize: 14, fontFamily: F.semibold, color: C.ink, marginBottom: 2 },
  trustSub: { fontSize: 12, fontFamily: F.regular, color: C.ink3, lineHeight: 18 },

  // Form
  field: { marginBottom: 18 },
  fieldLabel: { fontSize: 11, fontFamily: F.bold, color: C.ink3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  optional: { fontFamily: F.regular, textTransform: 'none', letterSpacing: 0, fontSize: 11 },
  inputBox: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  inputBoxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, fontSize: 15, fontFamily: F.regular, color: C.ink, padding: 0 },
  rupeePrefix: { fontSize: 15, fontFamily: F.regular, color: C.ink3, flexShrink: 0 },
  hint: { fontSize: 11.5, fontFamily: F.regular, color: C.ink3, marginTop: 6, lineHeight: 18 },

  // Account type chips (step 5)
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: C.surface,
  },
  chipActive: { borderColor: C.brand, backgroundColor: C.brandPale },
  chipText: { fontSize: 13, fontFamily: F.medium, color: C.ink3 },
  chipTextActive: { color: C.brand, fontFamily: F.semibold },

  // Account category cards (step 4)
  typeCards: { gap: 12 },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1.5,
    borderColor: C.line,
    padding: 18,
  },
  typeCardActive: { borderColor: C.brand, backgroundColor: C.brandPale },
  typeCardBody: { flex: 1 },
  typeCardTitle: { fontSize: 15, fontFamily: F.semibold, color: C.ink, marginBottom: 2 },
  typeCardTitleActive: { color: C.brand },
  typeCardSub: { fontSize: 12, fontFamily: F.regular, color: C.ink3 },
  typeCardCheck: { marginLeft: 12 },

  // UPI IDs (step 6)
  upiList: {
    backgroundColor: C.surface,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line,
    marginTop: 12,
    overflow: 'hidden',
  },
  upiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  upiId: { flex: 1, fontSize: 13, fontFamily: F.mono, color: C.ink },
  removeText: { fontSize: 12, fontFamily: F.semibold, color: C.neg },
  addAction: { fontSize: 13, fontFamily: F.bold, color: C.brand },

  // Categories (step 7)
  catsLoading: { paddingVertical: 48, alignItems: 'center' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: C.surface,
  },
  catChipActive: { borderColor: C.brand, backgroundColor: C.brandPale },
  catDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  catChipText: { fontSize: 13, fontFamily: F.medium, color: C.ink3 },
  catChipTextActive: { color: C.ink, fontFamily: F.semibold },

  // Buttons
  btn: {
    backgroundColor: C.brand,
    borderRadius: RADIUS,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: C.brand,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  btnOff: { opacity: 0.5 },
  btnPress: { opacity: 0.85 },
  btnText: { color: '#ffffff', fontSize: 15.5, fontFamily: F.bold },
  skipBtn: { alignItems: 'center', paddingVertical: 14 },
  skipText: { fontSize: 13.5, fontFamily: F.regular, color: C.ink3 },

  err: { fontSize: 12, fontFamily: F.regular, color: C.neg, marginTop: 6 },
})
