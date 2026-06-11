'use client'

import React, { useActionState, useState } from 'react'
import { requestOTP, verifyOTPAndSignIn } from './actions'
import type { RequestOTPState, VerifyOTPState } from './actions'
import BuddySVG from '@/components/BuddySVG'

function Sprouts({ style = {} }: { style?: React.CSSProperties }) {
  return (
    <svg width="120" height="60" viewBox="0 0 120 60" fill="none" style={{ ...style, opacity: 0.18 }}>
      <path d="M20 50 C20 35 10 30 5 35 C2 40 10 48 20 50Z" fill="#1A936F" />
      <path d="M20 50 C20 36 28 32 32 36 C34 40 27 49 20 50Z" fill="#2BA77F" />
      <path d="M20 55 L20 47" stroke="#0F5132" strokeWidth="2" strokeLinecap="round" />
      <path d="M60 45 C60 32 52 28 48 32 C46 36 53 44 60 45Z" fill="#1A936F" />
      <path d="M60 45 C60 33 67 30 70 33 C72 37 66 45 60 45Z" fill="#2BA77F" />
      <path d="M60 50 L60 42" stroke="#0F5132" strokeWidth="2" strokeLinecap="round" />
      <path d="M100 48 C100 36 92 32 88 36 C86 39 93 47 100 48Z" fill="#1A936F" />
      <path d="M100 48 C100 37 107 34 110 37 C111 40 105 48 100 48Z" fill="#2BA77F" />
      <path d="M100 53 L100 45" stroke="#0F5132" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function WordMark({ color = 'var(--pb-ink)', accent = 'var(--pb-brand)', size = 24 }: { color?: string; accent?: string; size?: number }) {
  return (
    <span style={{ fontWeight: 800, fontSize: size, letterSpacing: '-0.02em', color, lineHeight: 1, whiteSpace: 'nowrap' }}>
      Paisa <span style={{ color: accent }}>Buddy</span>
    </span>
  )
}

function DesktopLeftPanel() {
  return (
    <div style={{
      width: '45%', background: 'linear-gradient(160deg, var(--pb-brand-deep), var(--pb-brand))',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: '#fff', position: 'relative', overflow: 'hidden', padding: 40, flexShrink: 0,
    }}>
      <Sprouts style={{ position: 'absolute', top: 40, left: 30 }} />
      <Sprouts style={{ position: 'absolute', bottom: 60, right: 20, opacity: 0.15, transform: 'scaleX(-1)' }} />
      <BuddySVG size={110} />
      <div style={{ marginTop: 20 }}>
        <WordMark color="#fff" accent="rgba(255,255,255,0.75)" size={28} />
      </div>
      <div style={{ fontSize: 16, opacity: 0.85, marginTop: 10, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
        Track every paisa, effortlessly. Your money, growing.
      </div>
    </div>
  )
}

const INPUT_STYLE: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
  background: 'var(--pb-surface)', border: '1.5px solid var(--pb-line)',
  borderRadius: 12, padding: '13px 14px',
}

const BTN_STYLE: React.CSSProperties = {
  width: '100%', background: 'var(--pb-brand)', borderRadius: 14, padding: '16px 0',
  textAlign: 'center', color: '#fff', fontSize: 15.5, fontWeight: 700, border: 'none',
  cursor: 'pointer', fontFamily: 'inherit', marginTop: 8,
  boxShadow: '0 8px 20px color-mix(in srgb, var(--pb-brand) 40%, transparent)',
}

const TERMS = (
  <p style={{ fontSize: 12, color: 'var(--pb-ink-3)', textAlign: 'center', lineHeight: 1.5 }}>
    By continuing, you agree to our{' '}
    <span style={{ color: 'var(--pb-brand)', fontWeight: 600 }}>Terms</span> and{' '}
    <span style={{ color: 'var(--pb-brand)', fontWeight: 600 }}>Privacy Policy</span>
  </p>
)

export default function LoginPage() {
  const [showEmail, setShowEmail] = useState(false)
  const [emailState, emailAction, emailPending] = useActionState<RequestOTPState, FormData>(requestOTP, {})
  const [otpState, otpAction, otpPending] = useActionState<VerifyOTPState, FormData>(verifyOTPAndSignIn, {})

  // ── OTP screen ──────────────────────────────────────────────────
  if (emailState.email && !showEmail) {
    const OtpForm = (
      <form action={otpAction} style={{ width: '100%', maxWidth: 340 }}>
        <input type="hidden" name="email" value={emailState.email} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <button type="button" onClick={() => setShowEmail(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pb-ink-3)', padding: 0, display: 'flex', alignItems: 'center', fontSize: 20, lineHeight: 1 }}>←</button>
          <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--pb-ink)' }}>Check your email</div>
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--pb-ink-3)', marginBottom: 22, lineHeight: 1.4 }}>
          We sent a 6-digit code to <strong style={{ color: 'var(--pb-ink)' }}>{emailState.email}</strong>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pb-ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            Login code
          </div>
          <div style={INPUT_STYLE}>
            <input
              name="token"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="123456"
              autoComplete="one-time-code"
              autoFocus
              required
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 20, letterSpacing: '0.25em', color: 'var(--pb-ink)', fontFamily: '"Space Mono", monospace' }}
            />
          </div>
          {otpState.error && <p style={{ fontSize: 12, color: 'var(--pb-neg)', marginTop: 6 }}>{otpState.error}</p>}
        </div>
        <button type="submit" disabled={otpPending} style={{ ...BTN_STYLE, opacity: otpPending ? 0.6 : 1, cursor: otpPending ? 'not-allowed' : 'pointer' }}>
          {otpPending ? 'Verifying…' : 'Sign in'}
        </button>
      </form>
    )

    return (
      <div style={{ minHeight: '100dvh', display: 'flex', background: 'var(--pb-bg)', fontFamily: '"Plus Jakarta Sans", system-ui' }}>
        {/* desktop left panel */}
        <div className="hidden md:flex" style={{ width: '45%', background: 'linear-gradient(160deg, var(--pb-brand-deep), var(--pb-brand))', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', position: 'relative', overflow: 'hidden', padding: 40, flexShrink: 0 }}>
          <Sprouts style={{ position: 'absolute', top: 40, left: 30 }} />
          <Sprouts style={{ position: 'absolute', bottom: 60, right: 20, opacity: 0.15, transform: 'scaleX(-1)' }} />
          <BuddySVG size={110} />
          <div style={{ marginTop: 20 }}><WordMark color="#fff" accent="rgba(255,255,255,0.75)" size={28} /></div>
          <div style={{ fontSize: 16, opacity: 0.85, marginTop: 10, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
            Track every paisa, effortlessly. Your money, growing.
          </div>
        </div>
        {/* form */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 32px' }}>
          {OtpForm}
        </div>
      </div>
    )
  }

  // ── Email screen ─────────────────────────────────────────────────
  const EmailForm = (
    <form action={emailAction} onSubmit={() => setShowEmail(false)} style={{ width: '100%', maxWidth: 340 }}>
      <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--pb-ink)', marginBottom: 6 }}>Sign in</div>
      <div style={{ fontSize: 13.5, color: 'var(--pb-ink-3)', marginBottom: 22, lineHeight: 1.4 }}>
        We'll send a one-time code to your email.
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pb-ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
          Email address
        </div>
        <div style={INPUT_STYLE}>
          <input
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
            required
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: 'var(--pb-ink)', fontFamily: 'inherit' }}
          />
        </div>
        {emailState.error && <p style={{ fontSize: 12, color: 'var(--pb-neg)', marginTop: 6 }}>{emailState.error}</p>}
      </div>
      <button type="submit" disabled={emailPending} style={{ ...BTN_STYLE, opacity: emailPending ? 0.6 : 1, cursor: emailPending ? 'not-allowed' : 'pointer' }}>
        {emailPending ? 'Sending…' : 'Send code'}
      </button>
    </form>
  )

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', background: 'var(--pb-bg)', fontFamily: '"Plus Jakarta Sans", system-ui' }}>

      {/* ── Desktop ── */}
      <div className="hidden md:flex" style={{ width: '45%', background: 'linear-gradient(160deg, var(--pb-brand-deep), var(--pb-brand))', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', position: 'relative', overflow: 'hidden', padding: 40, flexShrink: 0 }}>
        <Sprouts style={{ position: 'absolute', top: 40, left: 30 }} />
        <Sprouts style={{ position: 'absolute', bottom: 60, right: 20, opacity: 0.15, transform: 'scaleX(-1)' }} />
        <BuddySVG size={110} />
        <div style={{ marginTop: 20 }}><WordMark color="#fff" accent="rgba(255,255,255,0.75)" size={28} /></div>
        <div style={{ fontSize: 16, opacity: 0.85, marginTop: 10, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
          Track every paisa, effortlessly. Your money, growing.
        </div>
      </div>
      <div className="hidden md:flex" style={{ flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
        {EmailForm}
        <div style={{ marginTop: 20 }}>{TERMS}</div>
      </div>

      {/* ── Mobile ── */}
      <div className="flex md:hidden" style={{ flex: 1, flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 32px 40px' }}>
          {/* Buddy hero */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Sprouts style={{ position: 'absolute', top: -20, left: -44 }} />
            <BuddySVG size={90} />
          </div>
          <div style={{ marginTop: 12 }}>
            <WordMark size={24} />
          </div>
          <div style={{ fontSize: 14, color: 'var(--pb-ink-3)', marginTop: 8, textAlign: 'center' }}>
            Track every paisa, effortlessly.
          </div>
          <div style={{ width: '100%', marginTop: 36 }}>
            {EmailForm}
          </div>
        </div>
        <div style={{ padding: '16px 32px 36px' }}>{TERMS}</div>
      </div>
    </div>
  )
}
