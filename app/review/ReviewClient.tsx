'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useScrollLock } from '@/lib/hooks/useScrollLock'
import {
  rejectTransaction,
  updateAndConfirmTransaction,
  confirmAllPendingTransactions,
  rejectAllPendingTransactions,
} from '@/app/actions/transactions'
import { createAccount } from '@/app/actions/accounts'
import { categoryColor } from '@/lib/categories'
import ConfirmModal from '@/components/ConfirmModal'
import BuddySVG from '@/components/BuddySVG'
import type { Transaction, TransactionType } from '@/lib/types/transaction'
import type { Account, AccountType } from '@/lib/types/account'
import { ACCOUNT_TYPE_LABELS } from '@/lib/types/account'
import { formatMonthLabel } from '@/lib/utils'

interface Props {
  transactions: Transaction[]
  categories: string[]
  accounts: Account[]
  categoryColors: Record<string, string>
}

// ─── helpers ────────────────────────────────────────────────────────────────

function getCatColor(cat: string | null | undefined, colorMap: Record<string, string>): string {
  return categoryColor(cat, colorMap)
}

function typeColor(t: TransactionType): string {
  if (t === 'credit') return 'var(--pb-pos)'
  if (t === 'transfer') return 'var(--pb-transfer)'
  return 'var(--pb-neg)'
}

function formatDisplay(paise: number, t: TransactionType): string {
  const rupees = (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return t === 'credit' ? `+₹${rupees}` : `−₹${rupees}`
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getCategoryHint(tx: Transaction): string | null {
  if (!tx.raw_ai_response) return null
  try {
    const parsed = JSON.parse(tx.raw_ai_response) as { category_hint?: string | null }
    return parsed.category_hint ?? null
  } catch {
    return null
  }
}

// ─── local edits ────────────────────────────────────────────────────────────

interface LocalEdits {
  type: TransactionType
  amountStr: string
  merchant: string
  description: string
  category: string
  accountId: string
  toAccountId: string
  bank: string
  upiRef: string
  date: string
  time: string
  isRecurring: boolean
}

function txToEdits(tx: Transaction): LocalEdits {
  return {
    type: tx.type,
    amountStr: String(tx.amount / 100),
    merchant: tx.merchant ?? '',
    description: tx.description,
    category: tx.category ?? '',
    accountId: tx.account_id ?? '',
    toAccountId: tx.to_account_id ?? '',
    bank: tx.bank ?? '',
    upiRef: tx.upi_ref ?? '',
    date: tx.date,
    time: tx.time ?? '',
    isRecurring: tx.is_recurring,
  }
}

function editsToSave(e: LocalEdits): Partial<Omit<Transaction, 'id' | 'created_at' | 'user_id'>> {
  const paise = Math.round(parseFloat(e.amountStr || '0') * 100)
  return {
    type: e.type,
    amount: paise,
    merchant: e.merchant.trim() || null,
    description: e.description.trim(),
    category: e.category || null,
    account_id: e.accountId || null,
    to_account_id: e.type === 'transfer' ? (e.toAccountId || null) : null,
    bank: e.bank.trim() || null,
    upi_ref: e.upiRef.trim() || null,
    date: e.date,
    time: e.time || null,
    is_recurring: e.isRecurring,
  }
}

function isConfirmable(e: LocalEdits): boolean {
  const paise = Math.round(parseFloat(e.amountStr || '0') * 100)
  if (!paise || paise <= 0) return false
  if (!e.description.trim()) return false
  if (!e.category) return false
  if (!e.accountId) return false
  if (e.type === 'transfer' && !e.toAccountId) return false
  return true
}

// ─── icon primitives ─────────────────────────────────────────────────────────

function UserIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function TagIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}

function NoteIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

function BankIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="22" x2="21" y2="22" />
      <line x1="6" y1="18" x2="6" y2="11" />
      <line x1="10" y1="18" x2="10" y2="11" />
      <line x1="14" y1="18" x2="14" y2="11" />
      <line x1="18" y1="18" x2="18" y2="11" />
      <polygon points="12 2 20 7 4 7" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function CardIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}

function HashIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function RepeatIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

// ─── ReviewTypeBadge ─────────────────────────────────────────────────────────

function ReviewTypeBadge({ type, small }: { type: TransactionType; small?: boolean }) {
  const color = typeColor(type)
  return (
    <span style={{
      fontSize: small ? 9 : 10.5, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
      color,
      background: `color-mix(in srgb, ${color} 12%, var(--pb-surface))`,
      borderRadius: 5, padding: small ? '2px 5px' : '3px 8px',
    }}>
      {type}
    </span>
  )
}

// ─── EditField ───────────────────────────────────────────────────────────────

function EditField({
  icon, label, valueNode, isEditing, onEdit, children,
}: {
  icon: React.ReactNode
  label: string
  valueNode: React.ReactNode
  isEditing: boolean
  onEdit: () => void
  children?: React.ReactNode
}) {
  return (
    <div style={{ borderTop: '1px solid var(--pb-line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
        <div style={{ flexShrink: 0, color: 'var(--pb-ink-3)', display: 'flex', alignItems: 'center' }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--pb-ink-3)', marginBottom: 2 }}>{label}</div>
          {valueNode}
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={onEdit}
            style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pb-ink-3)', display: 'flex', flexShrink: 0 }}
          >
            <PencilIcon />
          </button>
        )}
      </div>
      {isEditing && children && (
        <div style={{ paddingBottom: 12 }}>{children}</div>
      )}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function ReviewClient({ transactions, categories, accounts, categoryColors }: Props) {
  const router = useRouter()
  const prevCountRef = useRef(transactions.length)

  const [activeId, setActiveId] = useState<string | null>(transactions[0]?.id ?? null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkModal, setBulkModal] = useState<'confirm-all' | 'reject-all' | null>(null)

  // editing state
  const [editingField, setEditingField] = useState<string | null>(null)
  const [edits, setEdits] = useState<LocalEdits | null>(null)
  const [extraCats, setExtraCats] = useState<string[]>([])
  const [newCatInput, setNewCatInput] = useState('')
  const [extraAccounts, setExtraAccounts] = useState<Account[]>([])
  const [addingAccount, setAddingAccount] = useState(false)
  const [newAccName, setNewAccName] = useState('')
  const [newAccType, setNewAccType] = useState<AccountType>('savings')
  const [addingAccSaving, setAddingAccSaving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const activeTx = transactions.find((tx) => tx.id === activeId) ?? transactions[0] ?? null

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const tx of transactions) {
      const key = tx.date.slice(0, 7)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(tx)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, txs]) => ({ month, txs }))
  }, [transactions])

  useScrollLock(sheetOpen)

  // reset edits when active tx changes
  useEffect(() => {
    if (activeTx) {
      setEdits(txToEdits(activeTx))
      setEditingField(null)
      setShowAdvanced(false)
    }
  }, [activeTx?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // redirect when all cleared
  useEffect(() => {
    const prev = prevCountRef.current
    prevCountRef.current = transactions.length
    if (transactions.length === 0 && prev > 0) {
      const t = setTimeout(() => router.push('/'), 1500)
      return () => clearTimeout(t)
    }
  }, [transactions.length, router])

  // keep activeId valid
  useEffect(() => {
    if (transactions.length === 0) return
    if (!transactions.find((tx) => tx.id === activeId)) {
      setActiveId(transactions[0].id)
    }
  }, [transactions, activeId])

  // desktop keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingField) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const idx = transactions.findIndex((tx) => tx.id === activeId)
      if (e.key === 'ArrowDown' && idx < transactions.length - 1) {
        e.preventDefault()
        setActiveId(transactions[idx + 1].id)
      }
      if (e.key === 'ArrowUp' && idx > 0) {
        e.preventDefault()
        setActiveId(transactions[idx - 1].id)
      }
      if (e.key === 'ArrowRight') { e.preventDefault(); void handleConfirm() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); void handleReject() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }) // no dep array — needs fresh closures for handleConfirm/handleReject

  function computeNext(): Transaction | null {
    const idx = transactions.findIndex((tx) => tx.id === activeId)
    return transactions[idx + 1] ?? transactions[idx - 1] ?? null
  }

  async function handleConfirm() {
    if (!activeTx || !edits || loading) return
    const next = computeNext()
    setLoading(activeTx.id)
    try {
      await updateAndConfirmTransaction(activeTx.id, editsToSave(edits))
      setSheetOpen(false)
      if (next) setActiveId(next.id)
    } finally {
      setLoading(null)
    }
  }

  async function handleReject() {
    if (!activeTx || loading) return
    const next = computeNext()
    setLoading(activeTx.id)
    try {
      await rejectTransaction(activeTx.id)
      setSheetOpen(false)
      if (next) setActiveId(next.id)
    } finally {
      setLoading(null)
    }
  }

  async function handleBulkConfirm() {
    setBulkLoading(true)
    try {
      await confirmAllPendingTransactions()
      setBulkModal(null)
    } finally {
      setBulkLoading(false)
    }
  }

  async function handleBulkReject() {
    setBulkLoading(true)
    try {
      await rejectAllPendingTransactions()
      setBulkModal(null)
    } finally {
      setBulkLoading(false)
    }
  }

  function handleAddCat() {
    const name = newCatInput.trim()
    if (!name) return
    const allCats = getAllCats()
    if (!allCats.includes(name)) setExtraCats((prev) => [...prev, name])
    if (edits) setEdits({ ...edits, category: name })
    setNewCatInput('')
    setEditingField(null)
  }

  async function handleAddAccount() {
    const name = newAccName.trim()
    if (!name) return
    setAddingAccSaving(true)
    try {
      const newAcc = await createAccount({ name, type: newAccType, bank: null, currency: 'INR', opening_balance: 0 })
      setExtraAccounts((prev) => [...prev, newAcc])
      if (edits) setEdits({ ...edits, accountId: newAcc.id })
      setAddingAccount(false)
      setNewAccName('')
      setNewAccType('savings')
      setEditingField(null)
    } finally {
      setAddingAccSaving(false)
    }
  }

  function getAllCats(): string[] {
    const hint = activeTx ? getCategoryHint(activeTx) : null
    const base = hint && !categories.includes(hint) ? [...categories, hint] : categories
    return [...base, ...extraCats.filter((c) => !base.includes(c))]
  }

  function getAllAccounts(): Account[] {
    return [...accounts, ...extraAccounts.filter((a) => !accounts.find((x) => x.id === a.id))]
  }

  function formatAmountDisplay(str: string): string {
    if (!str) return ''
    const [int, dec] = str.split('.')
    const formatted = Number(int || 0).toLocaleString('en-IN')
    return dec !== undefined ? `${formatted}.${dec}` : formatted
  }

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const clean = e.target.value.replace(/[^0-9.]/g, '')
    const parts = clean.split('.')
    const val = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : clean
    if (edits) setEdits({ ...edits, amountStr: val })
  }

  // ─── empty state ─────────────────────────────────────────────────────────

  if (transactions.length === 0) {
    return (
      <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', gap: 12, paddingBottom: 80 }}>
        <BuddySVG size={80} mood="happy" />
        <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--pb-ink)', margin: 0 }}>All caught up!</p>
        <p style={{ fontSize: 14, color: 'var(--pb-ink-3)', margin: 0 }}>No transactions to review right now.</p>
      </main>
    )
  }

  // ─── shared sub-renders ───────────────────────────────────────────────────

  const allCats = getAllCats()
  const allAccounts = getAllAccounts()
  const hint = activeTx ? getCategoryHint(activeTx) : null
  const isLoading = activeTx ? loading === activeTx.id : false

  function renderBulkButtons(size: 'sm' | 'md' = 'sm') {
    const fs = size === 'sm' ? 12 : 12
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          type="button"
          onClick={() => setBulkModal('reject-all')}
          disabled={bulkLoading}
          style={{ fontSize: fs, fontWeight: 700, color: 'var(--pb-neg)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Reject all
        </button>
        <button
          type="button"
          onClick={() => setBulkModal('confirm-all')}
          disabled={bulkLoading}
          style={{ fontSize: fs, fontWeight: 700, color: '#fff', background: 'var(--pb-brand)', borderRadius: 10, padding: '7px 12px', border: 'none', cursor: 'pointer' }}
        >
          Confirm all
        </button>
      </div>
    )
  }

  function renderListRow(tx: Transaction, isActive: boolean, onClick: () => void) {
    const catColor = getCatColor(tx.category, categoryColors)
    const tColor = typeColor(tx.type)
    const isProc = loading === tx.id
    return (
      <button
        key={tx.id}
        type="button"
        onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
          padding: '13px 0', background: 'none', border: 'none', cursor: 'pointer',
          opacity: isProc ? 0.5 : 1,
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: 99, flexShrink: 0, background: catColor }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--pb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tx.merchant || tx.description}
            </span>
            <ReviewTypeBadge type={tx.type} small />
          </div>
          <div style={{ fontSize: 12, color: 'var(--pb-ink-3)', marginBottom: 1 }}>
            {tx.category && <span style={{ color: catColor, fontWeight: 700 }}>{tx.category}</span>}
            {tx.category && tx.description && <span> · </span>}
            <span>{tx.description}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--pb-ink-3)' }}>
            {formatDate(tx.date)}{tx.account_id ? ' · ' + (allAccounts.find((a) => a.id === tx.account_id)?.name ?? '') : ''}
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-space-mono, monospace)', fontWeight: 700, fontSize: 15, color: tColor, flexShrink: 0 }}>
          {formatDisplay(tx.amount, tx.type)}
        </div>
      </button>
    )
  }

  function renderEditFields(forceAdvanced = false) {
    if (!edits) return null
    const merchantLabel = edits.type === 'credit' ? 'Sender' : edits.type === 'transfer' ? 'Account' : 'Recipient'
    const tColor = typeColor(edits.type)

    return (
      <>
        {/* Recipient */}
        <EditField
          icon={<UserIcon />}
          label={merchantLabel.toUpperCase()}
          isEditing={editingField === 'merchant'}
          onEdit={() => setEditingField('merchant')}
          valueNode={
            editingField === 'merchant' ? (
              <input
                autoFocus
                type="text"
                value={edits.merchant}
                onChange={(e) => setEdits({ ...edits, merchant: e.target.value })}
                onBlur={() => setEditingField(null)}
                onKeyDown={(e) => { if (e.key === 'Enter') setEditingField(null) }}
                style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--pb-ink)', background: 'none', border: 'none', outline: 'none', width: '100%', padding: 0 }}
              />
            ) : (
              <span style={{ fontSize: 14.5, fontWeight: 600, color: edits.merchant ? 'var(--pb-ink)' : 'var(--pb-ink-3)' }}>
                {edits.merchant || 'Not set'}
              </span>
            )
          }
        />

        {/* Category */}
        <EditField
          icon={<TagIcon />}
          label="CATEGORY"
          isEditing={editingField === 'category'}
          onEdit={() => setEditingField(editingField === 'category' ? null : 'category')}
          valueNode={
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {edits.category && (
                <div style={{ width: 8, height: 8, borderRadius: 2, background: getCatColor(edits.category, categoryColors), flexShrink: 0 }} />
              )}
              <span style={{ fontSize: 14.5, fontWeight: 600, color: edits.category ? 'var(--pb-ink)' : 'var(--pb-ink-3)' }}>
                {edits.category || 'Not set'}
              </span>
            </div>
          }
        >
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {allCats.map((cat) => {
                const isHint = cat === hint && !activeTx?.category
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => { setEdits({ ...edits, category: cat === edits.category ? '' : cat }); setEditingField(null) }}
                    style={
                      edits.category === cat
                        ? { background: tColor, color: '#fff', borderRadius: 99, padding: '6px 12px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }
                        : isHint
                          ? { background: 'var(--pb-bg, var(--pb-brand-pale))', color: 'var(--pb-ink-3)', borderRadius: 99, padding: '6px 12px', fontSize: 13, border: `1px dashed ${tColor}`, cursor: 'pointer' }
                          : { background: 'var(--bg, var(--pb-brand-pale))', color: 'var(--pb-ink)', borderRadius: 99, padding: '6px 12px', fontSize: 13, border: '1px solid var(--pb-line)', cursor: 'pointer' }
                    }
                  >
                    {cat}{isHint && edits.category !== cat ? ' ✦' : ''}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'var(--pb-bg, #F4F6F2)', border: '1px solid var(--pb-line)' }}>
              <input
                type="text"
                placeholder="New category…"
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCat() } }}
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--pb-ink)' }}
              />
              <button
                type="button"
                onClick={handleAddCat}
                disabled={!newCatInput.trim()}
                style={{ fontSize: 12, fontWeight: 700, color: 'var(--pb-brand)', background: 'none', border: 'none', cursor: 'pointer', opacity: newCatInput.trim() ? 1 : 0.4 }}
              >
                Add
              </button>
            </div>
          </div>
        </EditField>

        {/* Notes */}
        <EditField
          icon={<NoteIcon />}
          label="NOTES"
          isEditing={editingField === 'description'}
          onEdit={() => setEditingField('description')}
          valueNode={
            editingField === 'description' ? (
              <input
                autoFocus
                type="text"
                value={edits.description}
                onChange={(e) => setEdits({ ...edits, description: e.target.value })}
                onBlur={() => setEditingField(null)}
                onKeyDown={(e) => { if (e.key === 'Enter') setEditingField(null) }}
                style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--pb-ink)', background: 'none', border: 'none', outline: 'none', width: '100%', padding: 0 }}
              />
            ) : (
              <span style={{ fontSize: 14.5, fontWeight: 600, color: edits.description ? 'var(--pb-ink)' : 'var(--pb-ink-3)' }}>
                {edits.description || 'Not set'}
              </span>
            )
          }
        />

        {/* Account */}
        <EditField
          icon={<BankIcon />}
          label="ACCOUNT"
          isEditing={editingField === 'account'}
          onEdit={() => setEditingField(editingField === 'account' ? null : 'account')}
          valueNode={
            <span style={{ fontSize: 14.5, fontWeight: 600, color: edits.accountId ? 'var(--pb-ink)' : 'var(--pb-ink-3)' }}>
              {allAccounts.find((a) => a.id === edits.accountId)?.name || 'Not set'}
            </span>
          }
        >
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {allAccounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => { setEdits({ ...edits, accountId: acc.id === edits.accountId ? '' : acc.id }); setEditingField(null) }}
                  style={
                    edits.accountId === acc.id
                      ? { background: tColor, color: '#fff', borderRadius: 99, padding: '6px 12px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }
                      : { background: 'var(--bg, var(--pb-brand-pale))', color: 'var(--pb-ink)', borderRadius: 99, padding: '6px 12px', fontSize: 13, border: '1px solid var(--pb-line)', cursor: 'pointer' }
                  }
                >
                  {acc.name}
                </button>
              ))}
            </div>
            {addingAccount ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--pb-bg, #F4F6F2)', border: '1px solid var(--pb-line)' }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Account name"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setAddingAccount(false) }}
                  style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--pb-ink)' }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(['savings', 'current', 'credit', 'wallet', 'other'] as AccountType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewAccType(t)}
                      style={
                        newAccType === t
                          ? { background: 'var(--pb-brand)', color: '#fff', borderRadius: 99, padding: '4px 10px', fontSize: 12, border: 'none', cursor: 'pointer' }
                          : { background: 'var(--pb-surface)', color: 'var(--pb-ink)', borderRadius: 99, padding: '4px 10px', fontSize: 12, border: '1px solid var(--pb-line)', cursor: 'pointer' }
                      }
                    >
                      {ACCOUNT_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setAddingAccount(false)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 12, color: 'var(--pb-ink-3)', border: '1px solid var(--pb-line)', background: 'none', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="button" onClick={handleAddAccount} disabled={!newAccName.trim() || addingAccSaving} style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', background: 'var(--pb-brand)', border: 'none', cursor: 'pointer', opacity: (!newAccName.trim() || addingAccSaving) ? 0.4 : 1 }}>
                    {addingAccSaving ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingAccount(true)}
                style={{ fontSize: 13, color: 'var(--pb-ink-3)', background: 'none', border: '1px dashed var(--pb-line)', borderRadius: 99, padding: '4px 12px', cursor: 'pointer' }}
              >
                + Add account
              </button>
            )}
          </div>
        </EditField>

        {/* To Account (transfer only) */}
        {edits.type === 'transfer' && (
          <EditField
            icon={<BankIcon />}
            label="TO ACCOUNT"
            isEditing={editingField === 'toAccount'}
            onEdit={() => setEditingField(editingField === 'toAccount' ? null : 'toAccount')}
            valueNode={
              <span style={{ fontSize: 14.5, fontWeight: 600, color: edits.toAccountId ? 'var(--pb-ink)' : 'var(--pb-ink-3)' }}>
                {allAccounts.find((a) => a.id === edits.toAccountId)?.name || 'Not set'}
              </span>
            }
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {allAccounts.filter((a) => a.id !== edits.accountId).map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => { setEdits({ ...edits, toAccountId: acc.id === edits.toAccountId ? '' : acc.id }); setEditingField(null) }}
                  style={
                    edits.toAccountId === acc.id
                      ? { background: tColor, color: '#fff', borderRadius: 99, padding: '6px 12px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }
                      : { background: 'var(--bg, var(--pb-brand-pale))', color: 'var(--pb-ink)', borderRadius: 99, padding: '6px 12px', fontSize: 13, border: '1px solid var(--pb-line)', cursor: 'pointer' }
                  }
                >
                  {acc.name}
                </button>
              ))}
            </div>
          </EditField>
        )}

        {/* Date */}
        <EditField
          icon={<CalendarIcon />}
          label="DATE"
          isEditing={editingField === 'date'}
          onEdit={() => setEditingField('date')}
          valueNode={
            editingField === 'date' ? (
              <input
                autoFocus
                type="date"
                value={edits.date}
                onChange={(e) => setEdits({ ...edits, date: e.target.value })}
                onBlur={() => setEditingField(null)}
                style={{ fontSize: 14, fontWeight: 600, color: 'var(--pb-ink)', background: 'none', border: 'none', outline: 'none', padding: 0 }}
              />
            ) : (
              <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--pb-ink)' }}>
                {formatDate(edits.date)}
              </span>
            )
          }
        />

        {/* Advanced section */}
        {!forceAdvanced && (
          <div style={{ borderTop: '1px solid var(--pb-line)', paddingTop: 10, paddingBottom: showAdvanced ? 0 : 4 }}>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--pb-ink-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {showAdvanced ? '▲' : '▼'} Advanced
            </button>
          </div>
        )}

        {(forceAdvanced || showAdvanced) && (
          <>
            {/* Time */}
            <EditField
              icon={<ClockIcon />}
              label="TIME"
              isEditing={editingField === 'time'}
              onEdit={() => setEditingField('time')}
              valueNode={
                editingField === 'time' ? (
                  <input
                    autoFocus
                    type="time"
                    value={edits.time}
                    onChange={(e) => setEdits({ ...edits, time: e.target.value })}
                    onBlur={() => setEditingField(null)}
                    style={{ fontSize: 14, fontWeight: 600, color: 'var(--pb-ink)', background: 'none', border: 'none', outline: 'none', padding: 0 }}
                  />
                ) : (
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: edits.time ? 'var(--pb-ink)' : 'var(--pb-ink-3)' }}>
                    {edits.time || 'Not set'}
                  </span>
                )
              }
            />

            {/* Bank */}
            <EditField
              icon={<CardIcon />}
              label="BANK"
              isEditing={editingField === 'bank'}
              onEdit={() => setEditingField('bank')}
              valueNode={
                editingField === 'bank' ? (
                  <input
                    autoFocus
                    type="text"
                    value={edits.bank}
                    onChange={(e) => setEdits({ ...edits, bank: e.target.value })}
                    onBlur={() => setEditingField(null)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setEditingField(null) }}
                    style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--pb-ink)', background: 'none', border: 'none', outline: 'none', width: '100%', padding: 0 }}
                  />
                ) : (
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: edits.bank ? 'var(--pb-ink)' : 'var(--pb-ink-3)' }}>
                    {edits.bank || 'Not set'}
                  </span>
                )
              }
            />

            {/* UPI Ref */}
            <EditField
              icon={<HashIcon />}
              label="UPI REF"
              isEditing={editingField === 'upiRef'}
              onEdit={() => setEditingField('upiRef')}
              valueNode={
                editingField === 'upiRef' ? (
                  <input
                    autoFocus
                    type="text"
                    value={edits.upiRef}
                    onChange={(e) => setEdits({ ...edits, upiRef: e.target.value })}
                    onBlur={() => setEditingField(null)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setEditingField(null) }}
                    style={{ fontSize: 14, fontWeight: 600, color: 'var(--pb-ink)', background: 'none', border: 'none', outline: 'none', width: '100%', padding: 0, fontFamily: 'var(--font-space-mono, monospace)' }}
                  />
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 600, color: edits.upiRef ? 'var(--pb-ink)' : 'var(--pb-ink-3)', fontFamily: edits.upiRef ? 'var(--font-space-mono, monospace)' : 'inherit' }}>
                    {edits.upiRef || 'Not set'}
                  </span>
                )
              }
            />

            {/* Recurring toggle */}
            <div style={{ borderTop: '1px solid var(--pb-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flexShrink: 0, color: 'var(--pb-ink-3)', display: 'flex' }}><RepeatIcon /></div>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--pb-ink)' }}>Recurring</span>
              </div>
              <button
                type="button"
                onClick={() => setEdits({ ...edits, isRecurring: !edits.isRecurring })}
                style={{
                  position: 'relative', width: 40, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer',
                  background: edits.isRecurring ? 'var(--pb-pos)' : 'var(--pb-line)',
                  transition: 'background 0.2s',
                }}
                aria-pressed={edits.isRecurring}
              >
                <span style={{
                  position: 'absolute', top: 4, left: 4, width: 16, height: 16, borderRadius: 99, background: '#fff',
                  transform: edits.isRecurring ? 'translateX(16px)' : 'translateX(0)',
                  transition: 'transform 0.2s',
                }} />
              </button>
            </div>
          </>
        )}
      </>
    )
  }

  function renderAmountHeader(large: boolean) {
    if (!edits || !activeTx) return null
    const tColor = typeColor(edits.type)
    const fontSize = large ? 44 : 34
    return editingField === 'amount' ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontFamily: 'var(--font-space-mono, monospace)', fontWeight: 700, fontSize, color: tColor }}>₹</span>
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          value={formatAmountDisplay(edits.amountStr)}
          onChange={handleAmountChange}
          onBlur={() => setEditingField(null)}
          onKeyDown={(e) => { if (e.key === 'Enter') setEditingField(null) }}
          style={{
            fontFamily: 'var(--font-space-mono, monospace)', fontWeight: 700, fontSize,
            color: tColor, WebkitTextFillColor: tColor, background: 'none', border: 'none', outline: 'none', padding: 0,
            width: `${Math.max(4, edits.amountStr.length + 1)}ch`,
          }}
        />
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setEditingField('amount')}
        style={{
          fontFamily: 'var(--font-space-mono, monospace)', fontWeight: 700, fontSize,
          color: tColor, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
        }}
      >
        ₹{formatAmountDisplay(edits.amountStr)}
      </button>
    )
  }

  function renderActionButtons() {
    const canConfirm = edits ? isConfirmable(edits) : false
    return (
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          type="button"
          onClick={handleReject}
          disabled={isLoading}
          style={{
            flex: 1, padding: '14px 0', borderRadius: 14, fontSize: 14, fontWeight: 700,
            color: 'var(--pb-neg)',
            border: '1.5px solid color-mix(in srgb, var(--pb-neg) 20%, var(--pb-surface))',
            background: 'color-mix(in srgb, var(--pb-neg) 8%, var(--pb-surface))',
            cursor: 'pointer', opacity: isLoading ? 0.5 : 1,
          }}
        >
          Reject
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm || isLoading}
          style={{
            flex: 2, padding: '14px 0', borderRadius: 14, fontSize: 14, fontWeight: 700,
            color: '#fff', background: 'var(--pb-brand)',
            boxShadow: '0 6px 16px color-mix(in srgb, var(--pb-brand) 35%, transparent)',
            border: 'none', cursor: 'pointer', opacity: (!canConfirm || isLoading) ? 0.5 : 1,
          }}
        >
          {isLoading ? 'Saving…' : `Confirm & next →`}
        </button>
      </div>
    )
  }

  const activeIdx = transactions.findIndex((tx) => tx.id === activeId)

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Mobile layout ── */}
      <main className="lg:hidden" style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 80 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 0' }}>
          <div>
            <span style={{ fontSize: 23, fontWeight: 800, color: 'var(--pb-ink)' }}>Review </span>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--pb-ink-3)' }}>({transactions.length})</span>
          </div>
          {renderBulkButtons('sm')}
        </div>

        {/* Helper */}
        <p style={{ fontSize: 12, color: 'var(--pb-ink-3)', margin: '8px 18px 0' }}>
          Tap any transaction to review and edit details
        </p>

        {/* List */}
        <div style={{ padding: '0 18px', marginTop: 12 }}>
          {grouped.map(({ month, txs }) => (
            <div key={month}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 4px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--pb-ink-3)' }}>
                  {formatMonthLabel(month)}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--pb-ink-3)', background: 'color-mix(in srgb, var(--pb-neg) 10%, var(--pb-surface))', borderRadius: 99, padding: '1px 7px' }}>
                  {txs.length}
                </span>
              </div>
              {txs.map((tx, i) => (
                <div key={tx.id} style={{ borderTop: i > 0 ? '1px solid var(--pb-line)' : 'none' }}>
                  {renderListRow(tx, tx.id === activeId, () => {
                    setActiveId(tx.id)
                    setSheetOpen(true)
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>

      {/* ── Mobile bottom sheet ── */}
      {sheetOpen && (
        <>
          <div
            className="lg:hidden"
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.3)' }}
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="lg:hidden"
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
              background: 'var(--pb-surface)', borderRadius: '22px 22px 0 0',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
              maxHeight: 'min(85dvh, 620px)', overflowY: 'auto', overflowX: 'hidden',
            }}
          >
            {/* drag handle */}
            <div style={{ padding: '10px 0 6px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--pb-line)' }} />
            </div>

            <div style={{ padding: '0 22px' }}>
              {/* sheet header */}
              {activeTx && edits && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!edits) return
                          const types: TransactionType[] = ['debit', 'credit', 'transfer']
                          const next = types[(types.indexOf(edits.type) + 1) % types.length]
                          setEdits({ ...edits, type: next })
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <ReviewTypeBadge type={edits.type} />
                      </button>
                      <span style={{ fontSize: 12, color: 'var(--pb-ink-3)' }}>{activeIdx + 1} of {transactions.length}</span>
                    </div>
                    <span style={{ fontSize: 12.5, color: 'var(--pb-ink-3)' }}>{formatDate(activeTx.date)}</span>
                  </div>

                  {/* amount */}
                  <div style={{ marginBottom: 6 }}>
                    {renderAmountHeader(false)}
                  </div>

                  {/* edit fields */}
                  {renderEditFields()}

                  {/* actions */}
                  <div style={{ padding: '16px 0 30px' }}>
                    {renderActionButtons()}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Desktop split view ── */}
      <div
        className="hidden lg:grid"
        style={{
          gridTemplateColumns: '400px 1fr',
          marginTop: 66,
          height: 'calc(100dvh - 66px)',
          overflow: 'hidden',
        }}
      >
        {/* Left: list */}
        <div style={{ borderRight: '1px solid var(--pb-line)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* panel header */}
          <div style={{ padding: '20px 22px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--pb-ink)' }}>Review</span>
              <span style={{
                background: 'var(--pb-neg)', color: '#fff', borderRadius: 99,
                padding: '2px 9px', fontSize: 11, fontWeight: 800,
              }}>
                {transactions.length}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button
                type="button"
                onClick={() => setBulkModal('reject-all')}
                disabled={bulkLoading}
                style={{ fontSize: 12, fontWeight: 700, color: 'var(--pb-neg)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={() => setBulkModal('confirm-all')}
                disabled={bulkLoading}
                style={{ fontSize: 12, fontWeight: 700, color: 'var(--pb-brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Confirm all
              </button>
            </div>
          </div>

          {/* list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {grouped.map(({ month, txs }) => (
              <div key={month}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 22px 4px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--pb-ink-3)' }}>
                    {formatMonthLabel(month)}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--pb-ink-3)', background: 'color-mix(in srgb, var(--pb-neg) 10%, var(--pb-surface))', borderRadius: 99, padding: '1px 7px' }}>
                    {txs.length}
                  </span>
                </div>
                {txs.map((tx) => {
                  const active = tx.id === activeId
                  const catColor = getCatColor(tx.category, categoryColors)
                  const tColor = typeColor(tx.type)
                  const isProc = loading === tx.id
                  return (
                    <button
                      key={tx.id}
                      type="button"
                      onClick={() => setActiveId(tx.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left',
                        padding: '14px 22px',
                        background: active ? 'var(--pb-brand-pale)' : 'transparent',
                        borderTop: 'none', borderRight: 'none',
                        borderLeft: active ? '3px solid var(--pb-brand)' : '3px solid transparent',
                        borderBottom: '1px solid var(--pb-line)',
                        cursor: 'pointer', opacity: isProc ? 0.5 : 1,
                      }}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: 99, flexShrink: 0, background: catColor }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--pb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tx.merchant || tx.description}
                          </span>
                          <ReviewTypeBadge type={tx.type} small />
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--pb-ink-3)', marginBottom: 1 }}>
                          {tx.category && <span style={{ color: catColor, fontWeight: 700 }}>{tx.category}</span>}
                          {tx.category && tx.description && <span> · </span>}
                          <span>{tx.description}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--pb-ink-3)' }}>
                          {formatDate(tx.date)}{tx.account_id ? ' · ' + (allAccounts.find((a) => a.id === tx.account_id)?.name ?? '') : ''}
                        </div>
                      </div>
                      <div style={{ fontFamily: 'var(--font-space-mono, monospace)', fontWeight: 700, fontSize: 14.5, color: tColor, flexShrink: 0 }}>
                        {formatDisplay(tx.amount, tx.type)}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Right: detail */}
        <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '28px 40px' }}>
          {activeTx && edits && (
            <>
              {/* header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      const types: TransactionType[] = ['debit', 'credit', 'transfer']
                      const next = types[(types.indexOf(edits.type) + 1) % types.length]
                      setEdits({ ...edits, type: next })
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <ReviewTypeBadge type={edits.type} />
                  </button>
                  <span style={{ fontSize: 13, color: 'var(--pb-ink-3)' }}>{activeIdx + 1} of {transactions.length}</span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--pb-ink-3)' }}>{formatDate(activeTx.date)}</span>
              </div>

              {/* amount */}
              <div style={{ margin: '8px 0 20px' }}>
                {renderAmountHeader(true)}
              </div>

              {/* fields card */}
              <div style={{
                background: 'var(--pb-surface)', border: '1px solid var(--pb-line)',
                borderRadius: 16, padding: '0 22px', marginBottom: 22,
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}>
                {renderEditFields(true)}
                <div style={{ height: 1 }} />
              </div>

              <div style={{ flex: 1 }} />

              {/* actions */}
              <div style={{ display: 'flex', gap: 14 }}>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isLoading}
                  style={{
                    padding: '14px 30px', borderRadius: 14, fontSize: 15, fontWeight: 700,
                    color: 'var(--pb-neg)',
                    border: '1.5px solid color-mix(in srgb, var(--pb-neg) 20%, var(--pb-surface))',
                    background: 'color-mix(in srgb, var(--pb-neg) 8%, var(--pb-surface))',
                    cursor: 'pointer', opacity: isLoading ? 0.5 : 1,
                  }}
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!(edits && isConfirmable(edits)) || isLoading}
                  style={{
                    flex: 1, padding: '14px 0', borderRadius: 14, fontSize: 15, fontWeight: 700,
                    color: '#fff', background: 'var(--pb-brand)', textAlign: 'center',
                    boxShadow: '0 8px 18px color-mix(in srgb, var(--pb-brand) 35%, transparent)',
                    border: 'none', cursor: 'pointer',
                    opacity: (!(edits && isConfirmable(edits)) || isLoading) ? 0.5 : 1,
                  }}
                >
                  {isLoading ? 'Saving…' : 'Confirm & next →'}
                </button>
              </div>

            </>
          )}
        </div>
      </div>

      {/* ── Bulk modals ── */}
      <ConfirmModal
        open={bulkModal === 'confirm-all'}
        title={`Confirm all ${transactions.length} transactions?`}
        message="All pending transactions will be confirmed with their current values."
        confirmLabel="Confirm all"
        confirmColor="var(--pb-brand)"
        onConfirm={handleBulkConfirm}
        onCancel={() => setBulkModal(null)}
      />
      <ConfirmModal
        open={bulkModal === 'reject-all'}
        title={`Reject all ${transactions.length} transactions?`}
        message="All pending transactions will be permanently deleted."
        confirmLabel="Reject all"
        confirmColor="var(--pb-neg)"
        onConfirm={handleBulkReject}
        onCancel={() => setBulkModal(null)}
      />
    </>
  )
}
