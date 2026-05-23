'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { completeSetup } from '@/app/actions/user-settings'

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

  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">One-time setup</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Help the app recognise your receipts correctly. You can add or change these anytime in Settings.
          </p>
        </div>

        {/* Display name */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
            YOUR NAME <span className="font-normal">(as it appears on receipts)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Sudhanshu Bhagwat"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
          />
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Used to identify if you are the sender or receiver in a receipt.
          </p>
        </div>

        {/* UPI IDs */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
            YOUR UPI IDs <span className="font-normal">(optional)</span>
          </label>
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            {upiIds.map((id) => (
              <div
                key={id}
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
              >
                <span className="text-sm font-mono">{id}</span>
                <button
                  onClick={() => setUpiIds((prev) => prev.filter((u) => u !== id))}
                  className="text-xs transition-opacity hover:opacity-60"
                  style={{ color: '#dc2626' }}
                >
                  Remove
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2 px-4 py-3" style={{ background: 'var(--surface)' }}>
              <input
                type="text"
                placeholder="yourname@upi"
                value={upiInput}
                onChange={(e) => setUpiInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddUpi() } }}
                className="flex-1 text-sm bg-transparent outline-none font-mono"
                style={{ color: 'var(--text)' }}
              />
              <button
                onClick={handleAddUpi}
                disabled={!upiInput.trim()}
                className="text-xs font-medium disabled:opacity-40"
                style={{ color: 'var(--text)' }}
              >
                Add
              </button>
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Strengthens debit/credit detection when your name alone isn't enough.
          </p>
        </div>

        <button
          onClick={handleContinue}
          disabled={!displayName.trim() || saving}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ background: '#dc2626', color: '#fff' }}
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </main>
  )
}
