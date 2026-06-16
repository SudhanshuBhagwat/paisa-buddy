'use client'

import Link from 'next/link'
import BuddyWelcomeB from './BuddyWelcomeB'

interface Props {
  onAddManually: () => void
}

export default function HomeEmptyState({ onAddManually }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px 40px', gap: 20, marginTop: 24 }}>
      <BuddyWelcomeB size={104} />

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--pb-ink)', letterSpacing: '-0.01em' }}>
          Let's get your paisa in order!
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--pb-ink-3)', marginTop: 5, lineHeight: 1.5 }}>
          Add your first transaction to start tracking.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 360 }}>
        <Link
          href="/settings/shortcut"
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 16px', borderRadius: 'var(--pb-radius)',
            background: 'var(--pb-surface)', border: '1px solid var(--pb-line)',
            boxShadow: 'var(--pb-card-shadow)', textDecoration: 'none',
          }}
        >
          <span style={{ fontSize: 22, lineHeight: 1 }}>📸</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--pb-ink)' }}>Scan receipts</div>
            <div style={{ fontSize: 12, color: 'var(--pb-ink-3)', marginTop: 1 }}>Set up your iPhone Shortcut</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pb-ink-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>

        <Link
          href="/import"
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 16px', borderRadius: 'var(--pb-radius)',
            background: 'var(--pb-surface)', border: '1px solid var(--pb-line)',
            boxShadow: 'var(--pb-card-shadow)', textDecoration: 'none',
          }}
        >
          <span style={{ fontSize: 22, lineHeight: 1 }}>📄</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--pb-ink)' }}>Import a statement</div>
            <div style={{ fontSize: 12, color: 'var(--pb-ink-3)', marginTop: 1 }}>PDF or Excel bank statement</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pb-ink-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>

        <button
          type="button"
          onClick={onAddManually}
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 16px', borderRadius: 'var(--pb-radius)',
            background: 'var(--pb-surface)', border: '1px solid var(--pb-line)',
            boxShadow: 'var(--pb-card-shadow)', cursor: 'pointer', fontFamily: 'inherit',
            textAlign: 'left', width: '100%',
          }}
        >
          <span style={{ fontSize: 22, lineHeight: 1 }}>✏️</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--pb-ink)' }}>Add manually</div>
            <div style={{ fontSize: 12, color: 'var(--pb-ink-3)', marginTop: 1 }}>Type in a transaction</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pb-ink-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
