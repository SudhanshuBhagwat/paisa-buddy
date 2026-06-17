import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { requestOtp, confirmOtp } from '../lib/api'
import { C, F, RADIUS } from '../lib/tokens'

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

function Sprouts() {
  return (
    <Svg width={120} height={60} viewBox="0 0 120 60" fill="none" opacity={0.18}>
      <Path d="M20 50 C20 35 10 30 5 35 C2 40 10 48 20 50Z" fill={C.brand} />
      <Path d="M20 50 C20 36 28 32 32 36 C34 40 27 49 20 50Z" fill="#2BA77F" />
      <Path d="M20 55 L20 47" stroke={C.brandDeep} strokeWidth="2" strokeLinecap="round" />
      <Path d="M60 45 C60 32 52 28 48 32 C46 36 53 44 60 45Z" fill={C.brand} />
      <Path d="M60 45 C60 33 67 30 70 33 C72 37 66 45 60 45Z" fill="#2BA77F" />
      <Path d="M60 50 L60 42" stroke={C.brandDeep} strokeWidth="2" strokeLinecap="round" />
      <Path d="M100 48 C100 36 92 32 88 36 C86 39 93 47 100 48Z" fill={C.brand} />
      <Path d="M100 48 C100 37 107 34 110 37 C111 40 105 48 100 48Z" fill="#2BA77F" />
      <Path d="M100 53 L100 45" stroke={C.brandDeep} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  )
}

type Step = 'email' | 'otp'

export function LoginScreen() {
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardOpen(true))
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false))

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  async function sendOtp() {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    try {
      await requestOtp(trimmed)
      setStep('otp')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code.')
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp() {
    const trimmed = otp.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    try {
      const { supabaseToken } = await confirmOtp(email.trim().toLowerCase(), trimmed)
      const { error: sessionErr } = await supabase.auth.verifyOtp({
        token_hash: supabaseToken,
        type: 'magiclink',
      })
      if (sessionErr) setError(sessionErr.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code.')
    } finally {
      setLoading(false)
    }
  }

  const bottomPad = Math.max(insets.bottom, 16) + 20

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          contentContainerStyle={[
            s.scroll,
            keyboardOpen && s.scrollKeyboard,
            { paddingBottom: bottomPad + (keyboardOpen ? 120 : 0) },
          ]}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* Hero */}
          <View style={[s.hero, keyboardOpen && s.heroKeyboard]}>
            <View style={s.buddyWrap}>
              <View style={[s.sproutsPos, keyboardOpen && s.sproutsHidden]}>
                <Sprouts />
              </View>
              <BuddySVG size={keyboardOpen ? 64 : 90} />
            </View>
            <View style={s.wordmarkRow}>
              <Text style={s.wordmarkPaisa}>Paisa </Text>
              <Text style={s.wordmarkBuddy}>Buddy</Text>
            </View>
            <Text style={s.tagline}>Track every paisa, effortlessly.</Text>
          </View>

          {/* Form */}
          <View style={s.form}>
            {step === 'email' ? (
              <>
                <Text style={s.formTitle}>Sign in</Text>
                <Text style={s.formSub}>We'll send a one-time code to your email.</Text>
                <View style={s.field}>
                  <Text style={s.fieldLabel}>Email address</Text>
                  <View style={s.inputBox}>
                    <TextInput
                      style={s.input}
                      placeholder="you@example.com"
                      placeholderTextColor={C.ink3}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      returnKeyType="send"
                      onSubmitEditing={sendOtp}
                    />
                  </View>
                  {error && <Text style={s.err}>{error}</Text>}
                </View>
                <Pressable
                  style={({ pressed }) => [
                    s.btn,
                    (loading || !email.trim()) && s.btnOff,
                    pressed && s.btnPress,
                  ]}
                  onPress={sendOtp}
                  disabled={loading || !email.trim()}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.btnText}>Send code</Text>
                  }
                </Pressable>
              </>
            ) : (
              <>
                <View style={s.otpHeader}>
                  <Pressable
                    onPress={() => { setStep('email'); setOtp(''); setError(null) }}
                    hitSlop={8}
                  >
                    <Text style={s.backArrow}>←</Text>
                  </Pressable>
                  <Text style={s.otpTitle}>Check your email</Text>
                </View>
                <Text style={s.formSub}>
                  We sent a 6-digit code to{' '}
                  <Text style={s.bold}>{email.trim().toLowerCase()}</Text>
                </Text>
                <View style={s.field}>
                  <Text style={s.fieldLabel}>Login code</Text>
                  <View style={s.inputBox}>
                    <TextInput
                      style={[s.input, s.otpInput]}
                      placeholder="123456"
                      placeholderTextColor={C.ink3}
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      maxLength={6}
                      onSubmitEditing={verifyOtp}
                      autoFocus
                    />
                  </View>
                  {error && <Text style={s.err}>{error}</Text>}
                </View>
                <Pressable
                  style={({ pressed }) => [
                    s.btn,
                    (loading || otp.trim().length < 6) && s.btnOff,
                    pressed && s.btnPress,
                  ]}
                  onPress={verifyOtp}
                  disabled={loading || otp.trim().length < 6}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.btnText}>Sign in</Text>
                  }
                </Pressable>
              </>
            )}
          </View>

          <View style={[s.termsWrap, { paddingBottom: bottomPad }]}>
            <Text style={s.terms}>
              By continuing, you agree to our{' '}
              <Text style={s.termsLink}>Terms</Text>
              {' '}and{' '}
              <Text style={s.termsLink}>Privacy Policy</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  kav: { flex: 1 },
  scroll: { paddingHorizontal: 32, paddingTop: 160 },
  scrollKeyboard: { paddingTop: 44 },

  hero: { alignItems: 'center', marginBottom: 36 },
  heroKeyboard: { marginBottom: 22 },
  buddyWrap: { marginBottom: 8 },
  sproutsPos: { position: 'absolute', top: -20, left: -44, zIndex: 0 },
  sproutsHidden: { opacity: 0 },
  wordmarkRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 12 },
  wordmarkPaisa: {
    fontSize: 24,
    fontFamily: F.extrabold,
    letterSpacing: -0.48,
    color: C.ink,
  },
  wordmarkBuddy: {
    fontSize: 24,
    fontFamily: F.extrabold,
    letterSpacing: -0.48,
    color: C.brand,
  },
  tagline: { fontSize: 14, fontFamily: F.regular, color: C.ink3, marginTop: 8, textAlign: 'center' },

  form: { width: '100%' },
  formTitle: { fontSize: 22, fontFamily: F.extrabold, color: C.ink, marginBottom: 6 },
  formSub: { fontSize: 13.5, fontFamily: F.regular, color: C.ink3, marginBottom: 22, lineHeight: 19 },
  bold: { fontFamily: F.bold, color: C.ink },
  field: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 12,
    fontFamily: F.bold,
    color: C.ink3,
    textTransform: 'uppercase',
    letterSpacing: 0.48,
    marginBottom: 8,
  },
  inputBox: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  input: { fontSize: 15, fontFamily: F.regular, color: C.ink, padding: 0 },
  otpInput: { fontSize: 20, fontFamily: F.mono, letterSpacing: 5 },
  btn: {
    backgroundColor: C.brand,
    borderRadius: RADIUS,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: C.brand,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  btnOff: { opacity: 0.5 },
  btnPress: { opacity: 0.85 },
  btnText: { color: '#ffffff', fontSize: 15.5, fontFamily: F.bold },
  err: { fontSize: 12, fontFamily: F.regular, color: C.neg, marginTop: 6 },

  otpHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  backArrow: { fontSize: 20, fontFamily: F.regular, color: C.ink3, lineHeight: 26 },
  otpTitle: { fontSize: 22, fontFamily: F.extrabold, color: C.ink },

  termsWrap: { paddingHorizontal: 32, paddingTop: 16 },
  terms: { fontSize: 12, fontFamily: F.regular, color: C.ink3, textAlign: 'center', lineHeight: 18 },
  termsLink: { fontFamily: F.semibold, color: C.brand },
})
