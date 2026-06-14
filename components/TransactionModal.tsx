'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useMotionValue, animate } from 'motion/react'
import { useScrollLock } from '@/lib/hooks/useScrollLock'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { today } from '@/lib/utils'
import { insertTransaction } from '@/app/actions/transactions'
import { addCategory } from '@/app/actions/categories'
import { createAccount } from '@/app/actions/accounts'
import type { TransactionType } from '@/lib/types/transaction'
import type { Account, AccountType } from '@/lib/types/account'
import { ACCOUNT_TYPE_LABELS } from '@/lib/types/account'

interface Props {
  open: boolean
  onClose: () => void
  categories: string[]
  accounts: Account[]
  month?: string // YYYY-MM — defaults to current month
}

const TYPES: { value: TransactionType; label: string; color: string }[] = [
  { value: 'credit', label: 'Credit', color: 'var(--pb-pos)' },
  { value: 'debit', label: 'Debit', color: 'var(--pb-neg)' },
  { value: 'transfer', label: 'Transfer', color: 'var(--pb-transfer)' },
]

function defaultDateForMonth(month?: string): string {
  const current = today()
  if (!month || current.startsWith(month)) return current
  return `${month}-01`
}

export default function TransactionModal({ open, onClose, categories, accounts, month }: Props) {
  useScrollLock(open)
  const isMobile = useIsMobile()
  const dragY = useMotionValue(0)
  const [type, setType] = useState<TransactionType>('debit')
  const [amountStr, setAmountStr] = useState('')
  const [merchant, setMerchant] = useState('')
  const [category, setCategory] = useState('')
  const [accountId, setAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(today())
  const [addingCat, setAddingCat] = useState(false)
  const [newCatInput, setNewCatInput] = useState('')
  const [extraAccounts, setExtraAccounts] = useState<Account[]>([])
  const [addingAccount, setAddingAccount] = useState(false)
  const [newAccName, setNewAccName] = useState('')
  const [newAccType, setNewAccType] = useState<AccountType>('savings')
  const [addingAccSaving, setAddingAccSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)

  const allAccounts = [
    ...accounts,
    ...extraAccounts.filter((a) => !accounts.find((x) => x.id === a.id)),
  ]

  useEffect(() => {
    if (open) {
      setType('debit')
      setAmountStr('')
      setMerchant('')
      setCategory('')
      setAccountId('')
      setToAccountId('')
      setNotes('')
      setDate(defaultDateForMonth(month))
      setAddingCat(false)
      setNewCatInput('')
      setAddingAccount(false)
      setNewAccName('')
      setNewAccType('savings')
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

  useEffect(() => {
    if (category === 'Settlement') {
      setType('transfer')
      setNotes('Credit Card Settlement')
      const fromAcc = allAccounts.find((a) => a.id === accountId)
      const toAcc = allAccounts.find((a) => a.id === toAccountId)
      if (fromAcc?.type === 'credit') setAccountId('')
      if (toAcc?.type !== 'credit') setToAccountId('')
    }
  }, [category])

  useEffect(() => {
    if (type === 'transfer' && toAccountId) {
      const acc = allAccounts.find((a) => a.id === toAccountId)
      if (acc) setMerchant(acc.name)
    } else if (type === 'transfer') {
      setMerchant('')
    }
  }, [toAccountId, type, allAccounts])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const paise = Math.round(parseFloat(amountStr) * 100)
    const needsToAccount = type === 'transfer'
    if (!paise || paise <= 0 || !merchant.trim() || !category || !notes.trim() || !accountId || (needsToAccount && !toAccountId)) return
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
        account_id: accountId,
        to_account_id: needsToAccount ? toAccountId : null,
        source: 'manual',
        raw_ai_response: null,
        confidence: null,
        reviewed: true,
        is_recurring: false,
        recurrence_group: null,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAddAccount() {
    const name = newAccName.trim()
    if (!name) return
    setAddingAccSaving(true)
    try {
      const newAcc = await createAccount({ name, type: newAccType, bank: null, currency: 'INR', opening_balance: 0 })
      setExtraAccounts((prev) => [...prev, newAcc])
      setAccountId(newAcc.id)
      setAddingAccount(false)
      setNewAccName('')
      setNewAccType('savings')
    } finally {
      setAddingAccSaving(false)
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

  const isSettlement = category === 'Settlement'
  const fromAccounts = isSettlement ? allAccounts.filter((a) => a.type !== 'credit') : allAccounts
  const toAccounts = isSettlement
    ? allAccounts.filter((a) => a.type === 'credit' && a.id !== accountId)
    : allAccounts.filter((a) => a.id !== accountId)

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
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center pointer-events-none">
            <motion.div
              className="w-full max-w-xl md:max-w-2xl rounded-t-2xl md:rounded-2xl pointer-events-auto"
              style={isMobile ? { background: 'var(--surface)', y: dragY } : { background: 'var(--surface)' }}
              {...(isMobile
                ? {
                    initial: { y: '100%' },
                    animate: { y: 0 },
                    exit: { y: '100%' },
                    transition: { type: 'spring', damping: 32, stiffness: 320, mass: 0.8 },
                  }
                : {
                    initial: { opacity: 0, scale: 0.95 },
                    animate: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
                    exit:    { opacity: 0, scale: 0.95, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } },
                  })}
            >
              <motion.div
                className="flex justify-center pt-3 pb-4 md:hidden touch-none"
                style={{ cursor: 'grab' }}
                drag={isMobile ? 'y' : false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0}
                onDrag={(_, info) => { dragY.set(Math.max(0, info.offset.y)) }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 80 || info.velocity.y > 400) {
                    onClose()
                  } else {
                    animate(dragY, 0, { type: 'spring', damping: 30, stiffness: 300 })
                  }
                }}
              >
                <motion.div
                  className="w-10 h-1 rounded-full"
                  style={{ background: 'var(--border)' }}
                  whileDrag={{ scaleX: 0.6 }}
                />
              </motion.div>

              <div style={{ maxHeight: 'calc(90dvh - 24px)', overflowY: 'auto' }}>
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
              <span className="font-light invisible select-none" aria-hidden="true" style={{ fontSize: '2.25rem' }}>₹</span>
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

            {/* Account */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                ACCOUNT <span style={{ color: 'var(--pb-neg)' }}>*</span>
              </label>
              {fromAccounts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {fromAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setAccountId(acc.id === accountId ? '' : acc.id)}
                      className="px-3 py-1.5 rounded-full text-sm transition-all"
                      style={
                        accountId === acc.id
                          ? { background: activeType.color, color: '#fff' }
                          : { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }
                      }
                    >
                      {acc.name}
                    </button>
                  ))}
                </div>
              )}
              {addingAccount ? (
                <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Account name"
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setAddingAccount(false) }}
                    className="px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {(['savings', 'current', 'credit', 'wallet', 'other'] as AccountType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewAccType(t)}
                        className="px-2.5 py-1 rounded-full text-xs transition-all"
                        style={newAccType === t ? { background: 'var(--pb-brand)', color: '#fff' } : { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
                      >
                        {ACCOUNT_TYPE_LABELS[t]}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAddingAccount(false)} className="flex-1 py-1.5 rounded-lg text-xs" style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}>
                      Cancel
                    </button>
                    <button type="button" onClick={handleAddAccount} disabled={!newAccName.trim() || addingAccSaving} className="flex-1 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40" style={{ background: 'var(--pb-brand)', color: '#fff' }}>
                      {addingAccSaving ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingAccount(true)}
                  className="self-start px-3 py-1.5 rounded-full text-sm"
                  style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px dashed var(--border)' }}
                >
                  + Add account
                </button>
              )}
            </div>

            {/* To Account (transfers only) */}
            {type === 'transfer' && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                  TO ACCOUNT <span style={{ color: 'var(--pb-neg)' }}>*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {toAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setToAccountId(acc.id === toAccountId ? '' : acc.id)}
                      className="px-3 py-1.5 rounded-full text-sm transition-all"
                      style={
                        toAccountId === acc.id
                          ? { background: activeType.color, color: '#fff' }
                          : { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }
                      }
                    >
                      {acc.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                {merchantLabel} <span style={{ color: 'var(--pb-neg)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder={merchantPlaceholder}
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                readOnly={type === 'transfer' && !!toAccountId}
                className="px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  background: type === 'transfer' && toAccountId ? 'var(--bg)' : 'var(--bg)',
                  color: type === 'transfer' && toAccountId ? 'var(--muted)' : 'var(--text)',
                  border: '1px solid var(--border)',
                  cursor: type === 'transfer' && toAccountId ? 'default' : undefined,
                }}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                NOTES <span style={{ color: 'var(--pb-neg)' }}>*</span>
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
              disabled={!amountStr || !merchant.trim() || !category || !notes.trim() || !accountId || (type === 'transfer' && !toAccountId) || submitting}
              className="w-full py-3.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
              style={{ background: activeType.color, color: '#fff' }}
            >
              {submitting ? 'Saving…' : 'Add Transaction'}
            </button>
          </form>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

