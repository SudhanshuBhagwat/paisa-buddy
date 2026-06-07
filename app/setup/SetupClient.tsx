'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { completeSetup } from '@/app/actions/user-settings'
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

const INPUT_WRAP: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
  background: 'var(--pb-surface)', border: '1.5px solid var(--pb-line)',
  borderRadius: 12, padding: '13px 14px',
}
const LABEL_STYLE: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--pb-ink-3)',
  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8,
}
const HELPER_STYLE: React.CSSProperties = { fontSize: 12, color: 'var(--pb-ink-3)', marginTop: 6, lineHeight: 1.4 }
const BTN_STYLE: React.CSSProperties = {
  width: '100%', background: 'var(--pb-brand)', borderRadius: 14, padding: '16px 0',
  color: '#fff', fontSize: 15.5, fontWeight: 700, border: 'none', cursor: 'pointer',
  fontFamily: 'inherit', marginTop: 8,
  boxShadow: '0 8px 20px color-mix(in srgb, var(--pb-brand) 40%, transparent)',
}

export default function SetupClient() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [upiIds, setUpiIds] = useState<string[]>([])
  const [upiInput, setUpiInput] = useState('')
  const [saving, setSaving] = useState(false)

  function handleAddUpi() {
    const id = upiInput.trim().toLowerCase()
    if (!id || upiIds.includes(id)) return
    setUpiIds((prev) => [...prev, id])
    setUpiInput('')
  }

  async function handleContinue() {
    setSaving(true)
    await completeSetup(displayName.trim(), upiIds)
    router.push('/')
  }

const InputFields = (
    <div style={{ width: '100%' }}>
      {/* Name input */}
      <div style={{ marginBottom: 16 }}>
        <div style={LABEL_STYLE}>Your name (as it appears on receipts)</div>
        <div style={INPUT_WRAP}>
          <input
            type="text"
            placeholder="e.g. Sudhanshu Bhagwat"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: 'var(--pb-ink)', fontFamily: 'inherit' }}
          />
        </div>
        <div style={HELPER_STYLE}>Used to identify if you are the sender or receiver in a receipt.</div>
      </div>

      {/* UPI input */}
      <div style={{ marginBottom: 16 }}>
        <div style={LABEL_STYLE}>Your UPI IDs (optional)</div>
        {upiIds.map((id) => (
          <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--pb-surface)', border: '1.5px solid var(--pb-line)', borderRadius: 12, padding: '13px 14px', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontFamily: '"Space Mono", monospace', color: 'var(--pb-ink)' }}>{id}</span>
            <button type="button" onClick={() => setUpiIds((p) => p.filter((u) => u !== id))} style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--pb-neg)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              Remove
            </button>
          </div>
        ))}
        <div style={INPUT_WRAP}>
          <input
            type="text"
            placeholder="yourname@upi"
            value={upiInput}
            onChange={(e) => setUpiInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddUpi() } }}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: 'var(--pb-ink)', fontFamily: '"Space Mono", monospace' }}
          />
          <button type="button" onClick={handleAddUpi} disabled={!upiInput.trim()} style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--pb-brand)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', opacity: upiInput.trim() ? 1 : 0.4 }}>
            Add
          </button>
        </div>
        <div style={HELPER_STYLE}>Strengthens debit/credit detection when your name alone isn't enough.</div>
      </div>
    </div>
  )

  const ActionButtons = (
    <button type="button" onClick={handleContinue} disabled={saving} style={{ ...BTN_STYLE, opacity: saving ? 0.6 : 1 }}>
      {saving ? 'Saving…' : 'Continue'}
    </button>
  )

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', background: 'var(--pb-bg)', fontFamily: '"Plus Jakarta Sans", system-ui' }}>

      {/* ── Desktop ── */}
      <div className="hidden md:flex" style={{ width: '45%', background: 'linear-gradient(160deg, var(--pb-brand-deep), var(--pb-brand))', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', position: 'relative', overflow: 'hidden', padding: 40, flexShrink: 0 }}>
        <Sprouts style={{ position: 'absolute', top: 40, left: 30 }} />
        <Sprouts style={{ position: 'absolute', bottom: 60, right: 20, opacity: 0.15, transform: 'scaleX(-1)' }} />
        <div style={{ position: 'relative' }}>
          <BuddySVG size={100} />
          <div style={{ position: 'absolute', top: -10, right: -108, background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', borderRadius: '14px 14px 14px 4px', padding: '8px 14px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', color: '#fff' }}>
            Almost there!
          </div>
        </div>
        <div style={{ marginTop: 20 }}><WordMark color="#fff" accent="rgba(255,255,255,0.75)" size={24} /></div>
        <div style={{ fontSize: 15, opacity: 0.85, marginTop: 10, textAlign: 'center', maxWidth: 260, lineHeight: 1.5 }}>
          Just a quick setup and you're good to go.
        </div>
      </div>
      <div className="hidden md:flex" style={{ flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ fontWeight: 800, fontSize: 28, color: 'var(--pb-ink)', marginBottom: 6 }}>One-time setup</div>
          <div style={{ fontSize: 15, color: 'var(--pb-ink-3)', marginBottom: 32, lineHeight: 1.5 }}>
            Help the app recognise your receipts correctly. You can change these anytime in Settings.
          </div>
          {InputFields}
          {ActionButtons}
        </div>
      </div>

      {/* ── Mobile ── */}
      <div className="flex md:hidden" style={{ flex: 1, flexDirection: 'column', padding: '60px 28px 40px' }}>
        {/* Buddy greeting */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{ position: 'relative' }}>
            <BuddySVG size={56} />
            <div style={{ position: 'absolute', top: -6, right: -88, background: 'var(--pb-brand-pale)', borderRadius: '12px 12px 12px 4px', padding: '6px 12px', fontSize: 11, fontWeight: 700, color: 'var(--pb-brand-deep)', whiteSpace: 'nowrap' }}>
              Almost there!
            </div>
          </div>
        </div>

        <div style={{ fontWeight: 800, fontSize: 24, color: 'var(--pb-ink)', marginBottom: 6 }}>One-time setup</div>
        <div style={{ fontSize: 14, color: 'var(--pb-ink-3)', marginBottom: 28, lineHeight: 1.5 }}>
          Help the app recognise your receipts correctly. You can change these anytime in Settings.
        </div>

        {InputFields}

        <div style={{ flex: 1 }} />
        {ActionButtons}
      </div>
    </div>
  )
}
