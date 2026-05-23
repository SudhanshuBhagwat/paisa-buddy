'use client'

import { useState } from 'react'
import Link from 'next/link'
import { regenerateUploadToken } from '@/app/actions/user-settings'

interface Props {
  token: string
  uploadUrl: string
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-all"
      style={copied
        ? { background: '#16a34a', color: '#fff' }
        : { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }
      }
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

const STEPS = [
  {
    title: 'Open the Shortcuts app on your iPhone',
    body: null,
  },
  {
    title: 'Create a new Shortcut',
    body: 'Tap the + button (top right).',
  },
  {
    title: 'Add a "Receive" action',
    body: 'Tap "Add Action" → search "Receive" → select "Receive input from Share Sheet" → set type to Images.',
  },
  {
    title: 'Add a "Repeat with each item" action',
    body: 'Tap + → search "Repeat with each" → set it to repeat with Shortcut Input. All following steps go inside this block.',
  },
  {
    title: 'Inside the repeat block — add "Get contents of URL"',
    body: 'Tap + → search "Get contents of URL" → set the URL to your endpoint above → tap Show More → set Method to POST, Request Body to Form. Add a field: Key = file, Value = Repeat Item (the magic variable), Type = File.',
  },
  {
    title: 'Add the upload token header',
    body: 'Still inside "Get contents of URL" → tap Headers → add: Key = X-Upload-Token, Value = your token above.',
  },
  {
    title: 'Outside the repeat block — add "Show Notification"',
    body: 'Tap + after the repeat block → search "Show Notification" → Title: Receipt queued ✓',
  },
  {
    title: 'Name and enable Share Sheet',
    body: 'Tap the Shortcut name at the top → rename to "Queue Receipt". Then tap the info icon (ⓘ) → toggle on "Show in Share Sheet" → under Share Sheet Types select Images.',
  },
  {
    title: 'Test it',
    body: 'Open Photos → select a receipt → tap Share → find "Queue Receipt" → run it. You should see the notification, then check the Review tab in this app.',
  },
]

export default function ShortcutClient({ token, uploadUrl }: Props) {
  const [currentToken, setCurrentToken] = useState(token)
  const [revealed, setRevealed] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const maskedToken = '•'.repeat(Math.min(currentToken.length, 24))

  async function handleRegenerate() {
    if (!confirmRegen) {
      setConfirmRegen(true)
      return
    }
    const newToken = await regenerateUploadToken()
    setCurrentToken(newToken)
    setRevealed(true)
    setConfirmRegen(false)
  }

  return (
    <main className="max-w-xl md:max-w-2xl mx-auto w-full min-h-dvh pb-20 md:pt-14 px-4">
      <div className="py-4 flex items-center gap-3">
        <Link
          href="/settings"
          className="p-1 -ml-1 rounded-lg"
          style={{ color: 'var(--muted)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h1 className="text-lg font-semibold">Shortcut Setup</h1>
      </div>

      <div className="flex flex-col gap-6">
        {/* Credentials */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-medium" style={{ color: 'var(--muted)' }}>YOUR CREDENTIALS</h2>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {/* Endpoint URL */}
            <div
              className="px-4 py-3 flex flex-col gap-2"
              style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
            >
              <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>ENDPOINT URL</span>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-mono truncate" style={{ color: 'var(--text)' }}>{uploadUrl}</span>
                <CopyButton text={uploadUrl} />
              </div>
            </div>

            {/* Upload token */}
            <div className="px-4 py-3 flex flex-col gap-2" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>UPLOAD TOKEN</span>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-mono truncate" style={{ color: 'var(--text)' }}>
                  {revealed ? currentToken : maskedToken}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setRevealed((r) => !r)}
                    className="p-1 rounded-lg"
                    style={{ color: 'var(--muted)' }}
                    aria-label={revealed ? 'Hide token' : 'Reveal token'}
                  >
                    {revealed ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                  <CopyButton text={currentToken} />
                </div>
              </div>
            </div>

            {/* Regenerate */}
            <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ background: 'var(--surface)' }}>
              <span className="text-sm" style={{ color: confirmRegen ? '#dc2626' : 'var(--muted)' }}>
                {confirmRegen ? 'Old token stops working immediately.' : 'Rotate token'}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {confirmRegen && (
                  <button
                    type="button"
                    onClick={() => setConfirmRegen(false)}
                    className="text-xs"
                    style={{ color: 'var(--muted)' }}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRegenerate}
                  className="shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-all"
                  style={confirmRegen
                    ? { background: '#dc2626', color: '#fff' }
                    : { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }
                  }
                >
                  {confirmRegen ? 'Confirm rotate' : 'Regenerate'}
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Keep your token private. Anyone with it can upload receipts to your account.
          </p>
        </section>

        {/* Instructions */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-medium" style={{ color: 'var(--muted)' }}>SETUP INSTRUCTIONS</h2>
          <div className="flex flex-col gap-3">
            {STEPS.map((step, i) => (
              <div
                key={i}
                className="flex gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <span
                  className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                  style={{ background: 'var(--bg)', color: 'var(--muted)' }}
                >
                  {i + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{step.title}</p>
                  {step.body && (
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>{step.body}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Troubleshooting */}
        <section className="flex flex-col gap-3 pb-4">
          <h2 className="text-xs font-medium" style={{ color: 'var(--muted)' }}>TROUBLESHOOTING</h2>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {[
              { issue: '"Unauthorised" error', fix: 'Double-check the Upload Token matches exactly — no extra spaces.' },
              { issue: 'No notification', fix: 'Check that the Shortcut has notification permissions in iOS Settings.' },
              { issue: 'Receipt not appearing', fix: 'Check your internet connection. The app must be reachable from your iPhone.' },
            ].map((item, i, arr) => (
              <div
                key={i}
                className="px-4 py-3 flex flex-col gap-0.5"
                style={{ background: 'var(--surface)', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : undefined }}
              >
                <p className="text-sm font-medium">{item.issue}</p>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>{item.fix}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
