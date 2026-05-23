'use client'

import { useEffect, useRef, useState } from 'react'
import { useScrollLock } from '@/lib/hooks/useScrollLock'
import { today } from '@/lib/utils'
import { insertTransaction } from '@/app/actions/transactions'
import { addCategory } from '@/app/actions/categories'
import type { TransactionType } from '@/lib/types/transaction'

interface Props {
  open: boolean
  onClose: () => void
  categories: string[]
}

const TYPES: { value: TransactionType; label: string; color: string }[] = [
  { value: 'credit', label: 'Credit', color: '#16a34a' },
  { value: 'debit', label: 'Debit', color: '#dc2626' },
  { value: 'transfer', label: 'Transfer', color: '#2563eb' },
]

export default function TransactionModal({ open, onClose, categories }: Props) {
  useScrollLock(open)
  const [type, setType] = useState<TransactionType>('debit')
  const [amountStr, setAmountStr] = useState('')
  const [merchant, setMerchant] = useState('')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(today())
  const [addingCat, setAddingCat] = useState(false)
  const [newCatInput, setNewCatInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setType('debit')
      setAmountStr('')
      setMerchant('')
      setCategory('')
      setNotes('')
      setDate(today())
      setAddingCat(false)
      setNewCatInput('')
      setTimeout(() => amountRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const paise = Math.round(parseFloat(amountStr) * 100)
    if (!paise || paise <= 0 || !merchant.trim() || !category || !notes.trim()) return
    setSubmitting(true)
    try {
      await insertTransaction({
        type,
        amount: paise,
        currency: 'INR',
        date,
        time: null,
        merchant: merchant.trim(),
        description: notes.trim(),
        upi_ref: null,
        bank: null,
        category,
        source: 'manual',
        raw_ai_response: null,
        confidence: null,
        reviewed: true,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAddCustomCategory() {
    const name = newCatInput.trim()
    if (!name) return
    await addCategory(name)
    setCategory(name)
    setAddingCat(false)
    setNewCatInput('')
  }

  if (!open) return null

  const activeType = TYPES.find((t) => t.value === type)!
  const merchantLabel = type === 'credit' ? 'SENDER' : type === 'transfer' ? 'ACCOUNT' : 'RECIPIENT'
  const merchantPlaceholder = type === 'credit' ? 'Who sent this?' : type === 'transfer' ? 'Which account?' : 'Who did you pay?'

  function formatDisplayAmount(raw: string): string {
    if (!raw) return ''
    const [intPart, decPart] = raw.split('.')
    const formatted = Number(intPart || 0).toLocaleString('en-IN')
    return decPart !== undefined ? `${formatted}.${decPart}` : formatted
  }

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const clean = e.target.value.replace(/[^0-9.]/g, '')
    const parts = clean.split('.')
    setAmountStr(parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : clean)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center pointer-events-none">
        <div
          className="w-full max-w-xl md:max-w-2xl rounded-t-2xl md:rounded-2xl pointer-events-auto"
          style={{ background: 'var(--surface)', maxHeight: '90dvh', overflowY: 'auto' }}
        >
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
          </div>

          <form onSubmit={handleSubmit} className="px-4 pb-8 pt-2 flex flex-col gap-5">
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

            <div className="flex items-center justify-center gap-2">
              <span className="font-light" style={{ color: activeType.color, fontSize: '2.25rem' }}>₹</span>
              <input
                ref={amountRef}
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={formatDisplayAmount(amountStr)}
                onChange={handleAmountChange}
                className="font-semibold bg-transparent border-none outline-none w-56 text-center tabular-nums"
                style={{ color: activeType.color, WebkitTextFillColor: activeType.color, fontSize: '2.25rem' }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                CATEGORY
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className="px-3 py-1.5 rounded-full text-sm transition-all"
                    style={
                      category === cat
                        ? { background: activeType.color, color: '#fff' }
                        : { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }
                    }
                  >
                    {cat}
                  </button>
                ))}
                {addingCat ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Category name"
                      value={newCatInput}
                      onChange={(e) => setNewCatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleAddCustomCategory() }
                        if (e.key === 'Escape') setAddingCat(false)
                      }}
                      className="px-3 py-1.5 rounded-full text-sm border outline-none w-32"
                      style={{ background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--border)' }}
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomCategory}
                      className="px-2 py-1.5 rounded-full text-sm"
                      style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingCat(true)}
                    className="px-3 py-1.5 rounded-full text-sm"
                    style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px dashed var(--border)' }}
                  >
                    + Custom
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                {merchantLabel} <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                placeholder={merchantPlaceholder}
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                NOTES <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="What was this for?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                DATE
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={!amountStr || !merchant.trim() || !category || !notes.trim() || submitting}
              className="w-full py-3.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
              style={{ background: activeType.color, color: '#fff' }}
            >
              {submitting ? 'Saving…' : 'Add Transaction'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
