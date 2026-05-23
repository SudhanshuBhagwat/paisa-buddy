'use client'

import { useEffect, useState } from 'react'
import type { Transaction, TransactionType } from '@/lib/types/transaction'

interface Props {
  transaction: Transaction
  categories: string[]
  onSave: (updates: Partial<Omit<Transaction, 'id' | 'created_at'>>) => void
  onClose: () => void
  saving: boolean
}

const TYPES: { value: TransactionType; label: string; color: string }[] = [
  { value: 'credit', label: 'Credit', color: '#16a34a' },
  { value: 'debit', label: 'Debit', color: '#dc2626' },
  { value: 'transfer', label: 'Transfer', color: '#2563eb' },
]

function getCategoryHint(tx: Transaction): string | null {
  if (!tx.raw_ai_response) return null
  try {
    const parsed = JSON.parse(tx.raw_ai_response) as { category_hint?: string | null }
    return parsed.category_hint ?? null
  } catch {
    return null
  }
}

export default function ReviewEditDrawer({ transaction: tx, categories, onSave, onClose, saving }: Props) {
  const categoryHint = getCategoryHint(tx)
  const defaultCategory = tx.category ?? categoryHint ?? ''

  const [type, setType] = useState<TransactionType>(tx.type)
  const [amountStr, setAmountStr] = useState(String(tx.amount / 100))
  const [date, setDate] = useState(tx.date)
  const [time, setTime] = useState(tx.time ?? '')
  const [merchant, setMerchant] = useState(tx.merchant ?? '')
  const [description, setDescription] = useState(tx.description)
  const [category, setCategory] = useState(defaultCategory)
  const [bank, setBank] = useState(tx.bank ?? '')
  const [upiRef, setUpiRef] = useState(tx.upi_ref ?? '')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const paise = Math.round(parseFloat(amountStr) * 100)
    if (!paise || paise <= 0) return
    onSave({
      type,
      amount: paise,
      date,
      time: time || null,
      merchant: merchant.trim() || null,
      description: description.trim(),
      category: category || null,
      bank: bank.trim() || null,
      upi_ref: upiRef.trim() || null,
    })
  }

  const activeType = TYPES.find((t) => t.value === type)!

  // All categories + hint (deduped)
  const allCats = categoryHint && !categories.includes(categoryHint)
    ? [...categories, categoryHint]
    : categories

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center pointer-events-none">
        <div
          className="w-full max-w-xl md:max-w-md rounded-t-2xl md:rounded-2xl pointer-events-auto"
          style={{ background: 'var(--surface)', maxHeight: '92dvh', overflowY: 'auto' }}
        >
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
          </div>

          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold">Edit & Confirm</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-sm"
              style={{ color: 'var(--muted)' }}
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-4 pb-8 flex flex-col gap-4">
            {/* Type selector */}
            <div className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--bg)' }}>
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
                  style={
                    type === t.value
                      ? { background: 'var(--surface)', color: t.color, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                      : { color: 'var(--muted)' }
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>AMOUNT</label>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--muted)' }}>₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm font-semibold tabular-nums"
                  style={{ color: activeType.color }}
                  required
                />
              </div>
            </div>

            {/* Date + Time */}
            <div className="flex gap-2">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>DATE</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5 w-28">
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>TIME</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                />
              </div>
            </div>

            {/* Merchant */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>MERCHANT</label>
              <input
                type="text"
                placeholder="e.g. Swiggy, Amazon"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>DESCRIPTION <span style={{ color: '#dc2626' }}>*</span></label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                required
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>CATEGORY</label>
              <div className="flex flex-wrap gap-2">
                {allCats.map((cat) => {
                  const isHint = cat === categoryHint && !tx.category
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat === category ? '' : cat)}
                      className="px-3 py-1.5 rounded-full text-sm transition-all"
                      style={
                        category === cat
                          ? { background: activeType.color, color: '#fff' }
                          : isHint
                            ? { background: 'var(--bg)', color: 'var(--muted)', border: `1px dashed ${activeType.color}` }
                            : { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }
                      }
                    >
                      {cat}{isHint && category !== cat ? ' ✦' : ''}
                    </button>
                  )
                })}
              </div>
              {categoryHint && !tx.category && (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>✦ AI suggested</p>
              )}
            </div>

            {/* Bank + UPI ref */}
            <div className="flex gap-2">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>BANK</label>
                <input
                  type="text"
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  className="px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>UPI REF</label>
                <input
                  type="text"
                  value={upiRef}
                  onChange={(e) => setUpiRef(e.target.value)}
                  className="px-3 py-2.5 rounded-xl text-sm outline-none font-mono"
                  style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!amountStr || !description.trim() || saving}
              className="w-full py-3.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40 mt-1"
              style={{ background: '#16a34a', color: '#fff' }}
            >
              {saving ? 'Saving…' : 'Confirm & Save'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
