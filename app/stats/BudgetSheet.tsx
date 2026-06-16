'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useScrollLock } from '@/lib/hooks/useScrollLock'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { OVERLAY_ANIM, SHEET_MOBILE_ANIM, DIALOG_ANIM } from '@/lib/modal-animations'
import { sanitizeAmountInput, parseAmountToPaise, formatDisplayAmount } from '@/lib/logic/amount'
import { upsertBudget, deleteBudget } from '@/app/actions/budgets'
import ConfirmModal from '@/components/ConfirmModal'
import type { BudgetWithSpent } from '@/lib/types/budget'
import type { CategoryWithColor } from '@/lib/db/types'

interface Props {
  open: boolean
  onClose: () => void
  editing: BudgetWithSpent | null
  budgets: BudgetWithSpent[]
  allCategories: CategoryWithColor[]
}

export default function BudgetSheet({ open, onClose, editing, budgets, allCategories }: Props) {
  const isMobile = useIsMobile()
  const [category, setCategory] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useScrollLock(open)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setCategory(editing.category)
      setAmountStr((editing.amount / 100).toString())
    } else {
      setCategory('')
      setAmountStr('')
    }
  }, [open, editing])

  const usedCategories = new Set(budgets.map((b) => b.category))
  const availableCategories = editing
    ? allCategories
    : allCategories.filter((c) => !usedCategories.has(c.name))

  const isValid = !!category && parseAmountToPaise(amountStr) > 0

  async function handleSave() {
    if (!isValid || saving) return
    setSaving(true)
    try {
      await upsertBudget(category, parseAmountToPaise(amountStr))
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editing || saving) return
    setSaving(true)
    try {
      await deleteBudget(editing.id)
      setConfirmDelete(false)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const sheetAnim = isMobile ? SHEET_MOBILE_ANIM : DIALOG_ANIM

  return (
    <>
      <ConfirmModal
        open={confirmDelete}
        title="Delete budget?"
        message="This will remove the budget. Your transactions won't be affected."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.4)' }}
              {...OVERLAY_ANIM}
              onClick={onClose}
            />
            <div
              className="fixed inset-0 z-40 pointer-events-none flex"
              style={{ alignItems: isMobile ? 'flex-end' : 'center', justifyContent: isMobile ? 'stretch' : 'center', padding: isMobile ? 0 : '0 16px' }}
            >
              <motion.div
                className="pointer-events-auto w-full"
                style={{
                  background: 'var(--pb-surface)',
                  border: '1px solid var(--pb-line)',
                  borderRadius: isMobile ? '20px 20px 0 0' : 16,
                  maxWidth: isMobile ? undefined : 420,
                  margin: isMobile ? undefined : '0 auto',
                  padding: isMobile ? '24px 24px 40px' : 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 20,
                }}
                {...sheetAnim}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--pb-ink)', margin: 0 }}>
                    {editing ? 'Edit Budget' : 'New Budget'}
                  </h2>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pb-ink-3)', padding: 4, display: 'flex', alignItems: 'center' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Category */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--pb-ink-3)', textTransform: 'uppercase' }}>
                    Category
                  </label>
                  {editing ? (
                    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--pb-bg)', border: '1px solid var(--pb-line)', fontSize: 14, color: 'var(--pb-ink-2)' }}>
                      {editing.category}
                    </div>
                  ) : availableCategories.length === 0 ? (
                    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--pb-bg)', border: '1px solid var(--pb-line)', fontSize: 13, color: 'var(--pb-ink-3)' }}>
                      All categories already have budgets.
                    </div>
                  ) : (
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      style={{
                        padding: '10px 12px', borderRadius: 10, background: 'var(--pb-bg)',
                        border: '1px solid var(--pb-line)', fontSize: 14, color: category ? 'var(--pb-ink)' : 'var(--pb-ink-3)',
                        fontFamily: 'inherit', outline: 'none', width: '100%', cursor: 'pointer',
                      }}
                    >
                      <option value="">Select category…</option>
                      {availableCategories.map((c) => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Monthly amount */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--pb-ink-3)', textTransform: 'uppercase' }}>
                    Monthly Budget
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--pb-bg)', border: '1px solid var(--pb-line)' }}>
                    <span style={{ fontSize: 15, color: 'var(--pb-ink-3)', flexShrink: 0 }}>₹</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formatDisplayAmount(amountStr)}
                      onChange={(e) => setAmountStr(sanitizeAmountInput(e.target.value.replace(/,/g, '')))}
                      placeholder="0"
                      style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, color: 'var(--pb-ink)', fontFamily: 'inherit' }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {editing && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      style={{
                        padding: '11px 16px', borderRadius: 10, border: '1px solid var(--pb-line)',
                        background: 'none', color: 'var(--pb-neg)', fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Delete
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!isValid || saving || (!editing && availableCategories.length === 0)}
                    style={{
                      flex: 1, padding: '11px 16px', borderRadius: 10, border: 'none',
                      background: isValid ? 'var(--pb-brand)' : 'var(--pb-line)',
                      color: isValid ? '#fff' : 'var(--pb-ink-3)',
                      fontSize: 13, fontWeight: 700,
                      cursor: isValid ? 'pointer' : 'default',
                      fontFamily: 'inherit', transition: 'background 0.15s',
                    }}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
