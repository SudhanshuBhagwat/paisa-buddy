'use client'

import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { PREDEFINED_CATEGORIES } from '@/lib/categories'
import { today, nanoid } from '@/lib/utils'
import type { TransactionType } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
}

const TYPES: { value: TransactionType; label: string; color: string }[] = [
  { value: 'credit', label: 'Credit', color: '#16a34a' },
  { value: 'debit', label: 'Debit', color: '#dc2626' },
  { value: 'transfer', label: 'Transfer', color: '#2563eb' },
]

export default function TransactionModal({ open, onClose }: Props) {
  const { state, dispatch } = useStore()
  const [type, setType] = useState<TransactionType>('debit')
  const [amountStr, setAmountStr] = useState('')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(today())
  const [addingCat, setAddingCat] = useState(false)
  const [newCatInput, setNewCatInput] = useState('')
  const amountRef = useRef<HTMLInputElement>(null)

  const allCategories = [...PREDEFINED_CATEGORIES, ...state.customCategories]

  useEffect(() => {
    if (open) {
      setType('debit')
      setAmountStr('')
      setCategory('')
      setNotes('')
      setDate(today())
      setAddingCat(false)
      setNewCatInput('')
      setTimeout(() => amountRef.current?.focus(), 100)
    }
  }, [open])

  // close on backdrop click via keyboard
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const paise = Math.round(parseFloat(amountStr) * 100)
    if (!paise || paise <= 0 || !category || !notes.trim()) return
    dispatch({
      type: 'ADD_TX',
      payload: {
        id: nanoid(),
        type,
        amount: paise,
        category,
        notes: notes.trim() || undefined,
        date,
        createdAt: new Date().toISOString(),
      },
    })
    onClose()
  }

  function handleAddCustomCategory() {
    const name = newCatInput.trim()
    if (!name) return
    dispatch({ type: 'ADD_CATEGORY', payload: name })
    setCategory(name)
    setAddingCat(false)
    setNewCatInput('')
  }

  if (!open) return null

  const activeType = TYPES.find((t) => t.value === type)!

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      />

      {/* Positioning wrapper — bottom sheet on mobile, centered modal on md+ */}
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center pointer-events-none">
        <div
          className="w-full max-w-xl md:max-w-md rounded-t-2xl md:rounded-2xl pointer-events-auto"
          style={{ background: 'var(--surface)', maxHeight: '90dvh', overflowY: 'auto' }}
        >
        {/* Handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        <form onSubmit={handleSubmit} className="px-4 pb-8 pt-2 flex flex-col gap-5">
          {/* Type selector */}
          <div
            className="flex rounded-xl p-1 gap-1"
            style={{ background: 'var(--bg)' }}
          >
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
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-light" style={{ color: 'var(--muted)' }}>₹</span>
            <input
              ref={amountRef}
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="text-4xl font-semibold bg-transparent border-none outline-none w-48 text-center tabular-nums"
              style={{ color: activeType.color }}
              required
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
              CATEGORY
            </label>
            <div className="flex flex-wrap gap-2">
              {allCategories.map((cat) => (
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

          {/* Notes — required */}
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

          {/* Date */}
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

          {/* Submit */}
          <button
            type="submit"
            disabled={!amountStr || !category || !notes.trim()}
            className="w-full py-3.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
            style={{ background: activeType.color, color: '#fff' }}
          >
            Add Transaction
          </button>
        </form>
        </div>
      </div>
    </>
  )
}
