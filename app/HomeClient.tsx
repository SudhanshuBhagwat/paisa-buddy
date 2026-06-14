'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, animate } from 'motion/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Transaction } from '@/lib/types/transaction'
import {
  calcSummary,
  formatAmount,
  formatDateLabel,
  addMonths,
  formatMonthLabel,
} from '@/lib/utils'
import type { TransactionType } from '@/lib/types/transaction'
import type { AccountWithBalance } from '@/lib/types/account'
import { ACCOUNT_TYPE_LABELS } from '@/lib/types/account'
import MonthPicker from '@/components/MonthPicker'
import TransactionList from '@/components/TransactionList'
import TransactionModal from '@/components/TransactionModal'
import CalendarView from '@/components/CalendarView'
import ReviewEditDrawer from '@/app/review/ReviewEditDrawer'
import { updateTransaction } from '@/app/actions/transactions'
import { useScrollLock } from '@/lib/hooks/useScrollLock'
import { useStore } from '@/lib/store'
import BuddySVG from '@/components/BuddySVG'

const CAL_VARIANTS = {
  enter: (dir: number) => ({ x: dir * 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -48, opacity: 0 }),
}

function AnimatedMoney({ value, prefix = '' }: { value: number; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const mv = useMotionValue(0)
  useEffect(() => {
    mv.set(0)
    const controls = animate(mv, value, { duration: 0.5, ease: 'easeOut' })
    const unsub = mv.on('change', (v) => {
      if (ref.current) ref.current.textContent = prefix + formatAmount(Math.round(v))
    })
    return () => { controls.stop(); unsub() }
  }, [value])
  return <span ref={ref}>{prefix + formatAmount(value)}</span>
}

function AnimatedBalanceSplit({
  value,
  intClassName, intStyle,
  decClassName, decStyle,
}: {
  value: number
  intClassName?: string; intStyle?: React.CSSProperties
  decClassName?: string; decStyle?: React.CSSProperties
}) {
  const intRef = useRef<HTMLSpanElement>(null)
  const decRef = useRef<HTMLSpanElement>(null)
  const mv = useMotionValue(0)
  useEffect(() => {
    mv.set(0)
    const controls = animate(mv, Math.abs(value), { duration: 0.5, ease: 'easeOut' })
    const unsub = mv.on('change', (v) => {
      const fmt = formatAmount(Math.round(v))
      const dot = fmt.lastIndexOf('.')
      const sign = value < 0 ? '–' : ''
      if (intRef.current) intRef.current.textContent = sign + (dot >= 0 ? fmt.slice(0, dot) : fmt)
      if (decRef.current) decRef.current.textContent = dot >= 0 ? '.' + fmt.slice(dot + 1) : ''
    })
    return () => { controls.stop(); unsub() }
  }, [value])
  const fmt = formatAmount(Math.abs(value))
  const dot = fmt.lastIndexOf('.')
  const sign = value < 0 ? '–' : ''
  const intPart = sign + (dot >= 0 ? fmt.slice(0, dot) : fmt)
  const decPart = dot >= 0 ? '.' + fmt.slice(dot + 1) : null
  return (
    <>
      <span ref={intRef} className={intClassName} style={intStyle}>{intPart}</span>
      {decPart != null && <span ref={decRef} className={decClassName} style={decStyle}>{decPart}</span>}
    </>
  )
}

function AnimatedCount({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const mv = useMotionValue(0)
  useEffect(() => {
    mv.set(0)
    const controls = animate(mv, value, { duration: 0.5, ease: 'easeOut' })
    const unsub = mv.on('change', (v) => {
      if (ref.current) ref.current.textContent = String(Math.round(v))
    })
    return () => { controls.stop(); unsub() }
  }, [value])
  return <span ref={ref}>{value}</span>
}

const CARD: React.CSSProperties = {
  background: 'var(--pb-surface)',
  border: '1px solid var(--pb-line)',
  borderRadius: 'var(--pb-radius)',
  boxShadow: 'var(--pb-card-shadow)',
}

const CHIP_BASE: React.CSSProperties = {
  appearance: 'none' as const,
  WebkitAppearance: 'none' as const,
  background: 'color-mix(in srgb, var(--pb-ink) 5%, var(--pb-surface))',
  border: 'none',
  borderRadius: 8,
  padding: '5px 22px 5px 8px',
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--pb-ink-2)',
  cursor: 'pointer',
  outline: 'none',
  fontFamily: 'inherit',
}

const TYPE_COLOR: Record<TransactionType, string> = {
  debit: 'var(--pb-neg)',
  credit: 'var(--pb-pos)',
  transfer: 'var(--pb-transfer)',
}

interface Props {
  transactions: Transaction[]
  categories: string[]
  accounts: AccountWithBalance[]
  month: string
  pendingCount: number
  displayName: string | null
  categoryColorMap: Record<string, string>
  expectedMonthlyIncome: number
}

export default function HomeClient({ transactions, categories, accounts, month: initialMonth, pendingCount, displayName, categoryColorMap, expectedMonthlyIncome }: Props) {
  const router = useRouter()
  const { dispatch } = useStore()
  const [month, setMonth] = useState(initialMonth)
  useEffect(() => { setMonth(initialMonth) }, [initialMonth])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<TransactionType | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [recurringOnly, setRecurringOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [calSheetOpen, setCalSheetOpen] = useState(false)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [greetingDate, setGreetingDate] = useState('')

  const calDirRef = useRef<number>(1)
  const isCalFirstMount = useRef(true)
  useEffect(() => { isCalFirstMount.current = false }, [])

  useScrollLock(calSheetOpen || filterSheetOpen || editingTx !== null)

  useEffect(() => {
    const now = new Date()
    const day = now.toLocaleDateString('en-IN', { weekday: 'long' })
    const date = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })
    setGreetingDate(`${day}, ${date}`)
  }, [])

  async function handleEditSave(updates: Partial<Omit<Transaction, 'id' | 'created_at'>>) {
    if (!editingTx) return
    setEditSaving(true)
    const finalUpdates = !editingTx.reviewed ? { ...updates, reviewed: true } : updates
    await updateTransaction(editingTx.id, finalUpdates)
    setEditSaving(false)
    setEditingTx(null)
  }

  useEffect(() => {
    setSelectedDate(null)
    setSelectedCategory(null)
    setSelectedType(null)
    setSelectedAccount(null)
    setRecurringOnly(false)
    setSearchQuery('')
  }, [month])

  const txs = transactions
  const q = searchQuery.trim().toLowerCase()
  const filteredTxs = txs.filter(
    (t) =>
      (!selectedDate || t.date === selectedDate) &&
      (!selectedCategory || t.category === selectedCategory) &&
      (!selectedType || t.type === selectedType) &&
      (!selectedAccount || t.account_id === selectedAccount) &&
      (!recurringOnly || t.is_recurring) &&
      (!q || t.merchant?.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)),
  )
  const { income, expense, balance, transfer } = calcSummary(txs)

  const balanceColor = balance >= 0 ? 'var(--pb-pos)' : 'var(--pb-neg)'

  const txCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const tx of txs) map.set(tx.date, (map.get(tx.date) ?? 0) + 1)
    return map
  }, [txs])

  const monthCategories = useMemo(
    () => Array.from(new Set(txs.map((t) => t.category).filter((c): c is string => c !== null))).sort(),
    [txs],
  )

  const statsRows = [
    { label: 'INCOME', value: income, color: 'var(--pb-pos)' },
    { label: 'SPENT', value: expense, color: 'var(--pb-neg)' },
    { label: 'TRANSFERS', value: transfer, color: 'var(--pb-transfer)' },
  ]

  const firstName = displayName ? displayName.split(' ')[0] : null

  const hasIncomeTarget = expectedMonthlyIncome > 0
  const incomeReceived = income
  const incomePending = Math.max(0, expectedMonthlyIncome - incomeReceived)
  const incomeRemaining = expectedMonthlyIncome - expense

  const buddyMood = hasIncomeTarget
    ? (incomeRemaining > 0 ? 'happy' : incomeRemaining < 0 ? 'sad' : 'neutral')
    : (balance > 0 ? 'happy' : balance < 0 ? 'sad' : 'neutral')
  useEffect(() => {
    dispatch({ type: 'SET_BUDDY_MOOD', payload: buddyMood })
  }, [buddyMood, dispatch])
  const incomeSpentPct = expectedMonthlyIncome > 0 ? Math.min(100, Math.round((expense / expectedMonthlyIncome) * 100)) : 0
  const incomeBarColor = incomeSpentPct >= 100 ? 'var(--pb-neg)' : incomeSpentPct >= 80 ? 'var(--pb-gold)' : 'var(--pb-brand)'

  // When income target set, show remaining budget as the headline number
  const displayBalance = hasIncomeTarget ? incomeRemaining : balance
  const displayBalanceColor = displayBalance >= 0 ? 'var(--pb-pos)' : 'var(--pb-neg)'

  function navigateMonth(delta: number) {
    calDirRef.current = delta > 0 ? 1 : -1
    const m = addMonths(month, delta)
    setMonth(m)
    router.push(`/?month=${m}`)
  }

  const hasFilters = !!(selectedType || selectedCategory || selectedAccount || recurringOnly)

  return (
    <main className="w-full mobile-content-pb md:pb-0 md:pt-[66px] min-h-dvh">

      {/* ═══ DESKTOP (lg+): 3-col card layout ═══ */}
      <div
        className="hidden lg:grid"
        style={{ gridTemplateColumns: '316px 1fr 326px', gap: 22, padding: '24px 24px 32px', height: 'calc(100dvh - 66px)' }}
      >
        {/* ── Left: Balance card + Accounts card ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          {/* Net balance card */}
          <div style={{ ...CARD, padding: 20 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--pb-ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {hasIncomeTarget ? 'Remaining' : 'Net balance'}
            </div>
            <div style={{ fontFamily: '"Space Mono", var(--font-space-mono, monospace)', fontWeight: 700, fontSize: 30, color: displayBalanceColor, marginTop: 6 }}>
              <AnimatedBalanceSplit
                value={displayBalance}
                decStyle={{ fontSize: 18, color: 'var(--pb-ink-3)' }}
              />
            </div>
            {hasIncomeTarget && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--pb-ink-3)' }}>
                    {formatAmount(expense)} of {formatAmount(expectedMonthlyIncome)} spent
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: incomeBarColor }}>{incomeSpentPct}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 99, background: 'var(--pb-line)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${incomeSpentPct}%`, borderRadius: 99, background: incomeBarColor, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--pb-line)' }}>
              {[
                { label: 'Income', value: income, color: 'var(--pb-pos)' },
                { label: 'Spent', value: expense, color: 'var(--pb-neg)' },
                { label: 'Transfers', value: transfer, color: 'var(--pb-transfer)' },
              ].map(({ label, value, color }, i) => (
                <div key={label} style={{ flex: 1, paddingLeft: i ? 14 : 0, borderLeft: i ? '1px solid var(--pb-line)' : 'none', minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--pb-ink-3)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
                  <div style={{ fontFamily: '"Space Mono", var(--font-space-mono, monospace)', fontWeight: 700, fontSize: 15, color, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <AnimatedMoney value={value} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Accounts card */}
          {accounts.length > 0 && (
            <div style={{ ...CARD, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--pb-ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Accounts
                </span>
                <Link href="/accounts" style={{ fontSize: 12, fontWeight: 700, color: 'var(--pb-brand)', textDecoration: 'none' }}>
                  Manage
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {accounts.map((acc) => {
                  const isCreditCard = acc.type === 'credit'
                  const accBalColor = isCreditCard || acc.current_balance < 0 ? 'var(--pb-neg)' : 'var(--pb-ink)'
                  return (
                    <div key={acc.id} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                        background: isCreditCard ? 'color-mix(in srgb, var(--pb-neg) 12%, var(--pb-surface))' : 'var(--pb-brand-pale)',
                        color: isCreditCard ? 'var(--pb-neg)' : 'var(--pb-brand)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isCreditCard ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                            <line x1="1" y1="10" x2="23" y2="10" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="3" y1="22" x2="21" y2="22" />
                            <line x1="6" y1="22" x2="6" y2="11" />
                            <line x1="18" y1="22" x2="18" y2="11" />
                            <polygon points="1 11 12 2 23 11" />
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--pb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {acc.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--pb-ink-3)' }}>{ACCOUNT_TYPE_LABELS[acc.type]}</div>
                      </div>
                      <div style={{ fontFamily: '"Space Mono", var(--font-space-mono, monospace)', fontWeight: 700, fontSize: 12.5, color: accBalColor, flexShrink: 0 }}>
                        {formatAmount(acc.current_balance)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Center: Search + filter chips + Transaction list ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, height: '100%' }}>
          {/* Search + filter chips card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...CARD, padding: '12px 18px', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--pb-ink-3)', flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or notes…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: 'var(--pb-ink-3)', fontFamily: 'inherit' }}
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} style={{ color: 'var(--pb-ink-3)', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
            <div style={{ height: 22, width: 1, background: 'var(--pb-line)', flexShrink: 0 }} />
            <div style={{ display: 'flex', gap: 6, flexShrink: 1, minWidth: 0, alignItems: 'center', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {/* Type chip */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <select
                  value={selectedType ?? ''}
                  onChange={(e) => setSelectedType((e.target.value as TransactionType) || null)}
                  style={{ ...CHIP_BASE, color: selectedType ? 'var(--pb-ink)' : 'var(--pb-ink-2)' }}
                >
                  <option value="">Type</option>
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                  <option value="transfer">Transfer</option>
                </select>
                <svg style={{ position: 'absolute', right: 6, pointerEvents: 'none', color: 'var(--pb-ink-3)' }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              {/* Category chip */}
              {monthCategories.length > 0 && (
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <select
                    value={selectedCategory ?? ''}
                    onChange={(e) => setSelectedCategory(e.target.value || null)}
                    style={{ ...CHIP_BASE, color: selectedCategory ? 'var(--pb-ink)' : 'var(--pb-ink-2)' }}
                  >
                    <option value="">Category</option>
                    {monthCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  <svg style={{ position: 'absolute', right: 6, pointerEvents: 'none', color: 'var(--pb-ink-3)' }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              )}
              {/* Account chip */}
              {accounts.length > 0 && (
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <select
                    value={selectedAccount ?? ''}
                    onChange={(e) => setSelectedAccount(e.target.value || null)}
                    style={{ ...CHIP_BASE, color: selectedAccount ? 'var(--pb-ink)' : 'var(--pb-ink-2)' }}
                  >
                    <option value="">Account</option>
                    {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                  </select>
                  <svg style={{ position: 'absolute', right: 6, pointerEvents: 'none', color: 'var(--pb-ink-3)' }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              )}
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => { setSelectedType(null); setSelectedCategory(null); setSelectedAccount(null); setRecurringOnly(false) }}
                  style={{ fontSize: 12, fontWeight: 700, color: 'var(--pb-brand)', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 0', fontFamily: 'inherit' }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Transaction list card */}
          <div style={{ flex: 1, overflow: 'hidden', ...CARD, overflowY: 'auto', paddingTop: 10, paddingBottom: 20 }}>
            {selectedDate && (
              <div className="flex items-center justify-between px-5 py-2 text-xs" style={{ borderBottom: '1px solid var(--pb-line)' }}>
                <span style={{ color: 'var(--pb-ink-3)' }}>Showing {formatDateLabel(selectedDate)}</span>
                <button onClick={() => setSelectedDate(null)} className="font-semibold" style={{ color: 'var(--pb-brand)', background: 'none', border: 'none', cursor: 'pointer' }}>Show all</button>
              </div>
            )}
            <TransactionList transactions={filteredTxs} onEdit={setEditingTx} compact colorMap={categoryColorMap} />
          </div>
        </div>

        {/* ── Right: Calendar card + Buddy tip ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          {/* Calendar card */}
          <div style={{ ...CARD, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <button
                onClick={() => navigateMonth(-1)}
                style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pb-ink-2)', display: 'flex' }}
                aria-label="Previous month"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <div style={{ textAlign: 'center', overflow: 'hidden' }}>
                <AnimatePresence mode="wait" custom={calDirRef.current}>
                  <motion.div
                    key={month}
                    custom={calDirRef.current}
                    variants={CAL_VARIANTS}
                    initial={isCalFirstMount.current ? false : 'enter'}
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                    style={{ fontSize: 14, fontWeight: 800, color: 'var(--pb-ink)' }}
                  >
                    {formatMonthLabel(month)}
                  </motion.div>
                </AnimatePresence>
                <div style={{ fontSize: 11, color: 'var(--pb-ink-3)' }}><AnimatedCount value={txs.length} /> transaction{txs.length !== 1 ? 's' : ''}</div>
              </div>
              <button
                onClick={() => navigateMonth(1)}
                style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pb-ink-2)', display: 'flex' }}
                aria-label="Next month"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
            <CalendarView
              month={month}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              transactionCounts={txCounts}
            />
            {selectedDate && (
              <div style={{ paddingTop: 8 }}>
                <button
                  onClick={() => setSelectedDate(null)}
                  style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'var(--pb-bg)', color: 'var(--pb-ink-3)', border: '1px solid var(--pb-line)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Show all transactions
                </button>
              </div>
            )}
          </div>

          {/* Buddy tip */}
          <div style={{ padding: 16, borderRadius: 'var(--pb-radius)', background: 'var(--pb-brand-pale)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BuddySVG size={28} mood={buddyMood} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--pb-brand-deep)' }}>Buddy tip</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--pb-brand-deep)', marginTop: 7, lineHeight: 1.45, opacity: 0.85 }}>
              {txs.length > 0
                ? `${txs.length} transaction${txs.length !== 1 ? 's' : ''} this month. Keep adding to see spending patterns!`
                : 'No transactions yet this month. Add your first one using the + button!'}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ TABLET + MOBILE (< lg) ═══ */}
      <div className="lg:hidden">

        {/* Mobile TopGreeting */}
        <div
          className="md:hidden flex items-center justify-between"
          style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 22px 8px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <BuddySVG size={48} mood={buddyMood} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--pb-ink)', letterSpacing: '-0.01em' }}>
                {firstName ? `Hi, ${firstName}` : 'Hi there'}
              </div>
              {greetingDate && (
                <div style={{ fontSize: 12.5, color: 'var(--pb-ink-3)', marginTop: 1 }}>{greetingDate}</div>
              )}
            </div>
          </div>
        </div>

        <div className="md:grid md:grid-cols-[1fr_328px]">

          {/* ── Center column ── */}
          <div className="md:border-r" style={{ borderColor: 'var(--border)' }}>
            <div className="max-w-xl mx-auto md:max-w-none">

              {/* MonthPicker: mobile only */}
              <div className="md:hidden py-2">
                <MonthPicker
                  value={month}
                  onChange={(m) => { setMonth(m); router.push(`/?month=${m}`) }}
                  onLabelClick={() => setCalSheetOpen(true)}
                  txCount={txs.length}
                />
              </div>

              {/* Balance card */}
              <div className="px-4 pt-3 pb-2">
                <div style={{ ...CARD, padding: '16px 14px' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--pb-ink-3)', letterSpacing: '0.05em' }}>{hasIncomeTarget ? 'Remaining' : 'Net balance'}</span>
                  </div>
                  <div className="flex items-baseline tabular-nums" style={{ color: displayBalanceColor, fontFamily: '"Space Mono", var(--font-space-mono, monospace)', marginBottom: hasIncomeTarget ? 10 : 12 }}>
                    <AnimatedBalanceSplit
                      value={displayBalance}
                      intClassName="font-bold"
                      intStyle={{ fontSize: 34, letterSpacing: '-0.02em' }}
                      decClassName="font-semibold"
                      decStyle={{ fontSize: 20, color: 'var(--pb-ink-3)' }}
                    />
                  </div>
                  {hasIncomeTarget && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <span style={{ fontSize: 11.5, color: 'var(--pb-ink-3)' }}>
                          {formatAmount(expense)} of {formatAmount(expectedMonthlyIncome)} spent
                        </span>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: incomeBarColor }}>{incomeSpentPct}%</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 99, background: 'var(--pb-line)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${incomeSpentPct}%`, borderRadius: 99, background: incomeBarColor, transition: 'width 0.4s ease' }} />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-3" style={{ paddingTop: 12, borderTop: '1px solid var(--pb-line)' }}>
                    {statsRows.map(({ label, value, color }, i) => (
                      <div key={label} className="flex flex-col gap-0.5" style={{ paddingLeft: i ? 10 : 0, borderLeft: i ? '1px solid var(--pb-line)' : 'none' }}>
                        <span className="text-xs font-bold tracking-wide" style={{ color: 'var(--pb-ink-3)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</span>
                        <span className="font-bold tabular-nums" style={{ fontSize: 14, color, fontFamily: '"Space Mono", var(--font-space-mono, monospace)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><AnimatedMoney value={value} /></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* iPad stats: removed — balance card above replaces this */}
              <div
                className="hidden"
                style={{ borderBottom: '1px solid var(--pb-line)' }}
              >
                {[
                  { label: 'Income', value: income, color: 'var(--pb-pos)' },
                  { label: 'Spent', value: expense, color: 'var(--pb-neg)' },
                  { label: 'Transfers', value: transfer, color: 'var(--pb-transfer)' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--pb-ink-3)', letterSpacing: '0.04em' }}>{label}</span>
                    <span className="text-sm font-bold tabular-nums" style={{ color, fontFamily: '"Space Mono", var(--font-space-mono, monospace)' }}><AnimatedMoney value={value} /></span>
                  </div>
                ))}
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--pb-ink-3)', letterSpacing: '0.04em' }}>Balance</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: balanceColor, fontFamily: '"Space Mono", var(--font-space-mono, monospace)' }}>
                    <AnimatedBalanceSplit value={balance} />
                  </span>
                </div>
              </div>

              {/* Pending review banner (mobile only) */}
              {pendingCount > 0 && (
                <Link
                  href="/review"
                  className="md:hidden flex items-center gap-3 px-4 py-3"
                  style={{ background: 'color-mix(in srgb, var(--pb-neg) 8%, var(--pb-surface))', borderTop: '1px solid var(--pb-line)', borderBottom: '1px solid var(--pb-line)' }}
                >
                  <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: 'var(--pb-neg)', color: '#fff' }}>
                    {pendingCount}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--pb-neg)' }}>Transactions pending review</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>From imports, shortcuts & bank statements</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--pb-neg)', flexShrink: 0 }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
              )}

              {/* Search bar */}
              <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--pb-line)' }}>
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--pb-surface)', border: '1px solid var(--pb-line)', boxShadow: 'var(--pb-card-shadow)' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)', flexShrink: 0 }}>
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by name or notes…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm"
                    style={{ color: 'var(--text)' }}
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery('')} style={{ color: 'var(--muted)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
                {txs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterSheetOpen(true)}
                    className="relative shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{
                      background: hasFilters ? 'var(--pb-brand)' : 'var(--pb-surface)',
                      border: '1px solid var(--pb-line)',
                      color: hasFilters ? '#fff' : 'var(--pb-ink-3)',
                    }}
                    aria-label="Open filters"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="4" y1="6" x2="20" y2="6" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                      <line x1="11" y1="18" x2="13" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Tablet type filter */}
              {txs.length > 0 && (
                <div className="hidden" style={{ borderBottom: '1px solid var(--border)', scrollbarWidth: 'none' }}>
                  <span className="shrink-0 text-sm font-bold pr-1" style={{ color: 'var(--muted)' }}>Type:</span>
                  {(['debit', 'credit', 'transfer'] as TransactionType[]).map((type) => {
                    const active = selectedType === type
                    return (
                      <button
                        key={type}
                        onClick={() => setSelectedType(active ? null : type)}
                        className="shrink-0 px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors"
                        style={active ? { background: TYPE_COLOR[type], color: '#fff' } : { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                      >
                        {type}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Tablet category filter */}
              {monthCategories.length > 0 && (
                <div className="hidden" style={{ borderBottom: '1px solid var(--border)', scrollbarWidth: 'none' }}>
                  <span className="shrink-0 text-sm font-bold pr-1" style={{ color: 'var(--muted)' }}>Category:</span>
                  {monthCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                      className="shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors"
                      style={selectedCategory === cat ? { background: 'var(--pb-neg)', color: '#fff' } : { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {selectedDate && (
                <div className="flex items-center justify-between px-3 py-2 text-xs" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--muted)' }}>Showing {formatDateLabel(selectedDate)}</span>
                  <button onClick={() => setSelectedDate(null)} className="font-medium" style={{ color: 'var(--text)' }}>Show all</button>
                </div>
              )}

              <TransactionList transactions={filteredTxs} onEdit={setEditingTx} colorMap={categoryColorMap} />
            </div>
          </div>

          {/* ── Right column: MonthPicker + Calendar (tablet) ── */}
          <div className="hidden md:block">
            <div className="sticky top-[66px]" style={{ maxHeight: 'calc(100dvh - 66px)', overflowY: 'auto' }}>
              <div className="py-[6px]" style={{ borderBottom: '1px solid var(--border)' }}>
                <MonthPicker value={month} onChange={(m) => { setMonth(m); router.push(`/?month=${m}`) }} txCount={txs.length} />
              </div>
              <CalendarView
                month={month}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                transactionCounts={txCounts}
              />
              {selectedDate && (
                <div className="px-3 pb-3">
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="w-full py-2 rounded-lg text-xs"
                    style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}
                  >
                    Show all transactions
                  </button>
                </div>
              )}

              {/* Accounts - tablet right column */}
              {accounts.length > 0 && (
                <div style={{ margin: '0 16px', ...CARD, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--pb-ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accounts</span>
                    <Link href="/accounts" style={{ fontSize: 12, fontWeight: 700, color: 'var(--pb-brand)', textDecoration: 'none' }}>Manage</Link>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {accounts.map((acc) => {
                      const isCreditCard = acc.type === 'credit'
                      const accBalColor = isCreditCard || acc.current_balance < 0 ? 'var(--pb-neg)' : 'var(--pb-ink)'
                      return (
                        <div key={acc.id} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                            background: isCreditCard ? 'color-mix(in srgb, var(--pb-neg) 12%, var(--pb-surface))' : 'var(--pb-brand-pale)',
                            color: isCreditCard ? 'var(--pb-neg)' : 'var(--pb-brand)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {isCreditCard ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                                <line x1="1" y1="10" x2="23" y2="10" />
                              </svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="3" y1="22" x2="21" y2="22" />
                                <line x1="6" y1="22" x2="6" y2="11" />
                                <line x1="18" y1="22" x2="18" y2="11" />
                                <polygon points="1 11 12 2 23 11" />
                              </svg>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--pb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--pb-ink-3)' }}>{ACCOUNT_TYPE_LABELS[acc.type]}</div>
                          </div>
                          <div style={{ fontFamily: '"Space Mono", var(--font-space-mono, monospace)', fontWeight: 700, fontSize: 12.5, color: accBalColor, flexShrink: 0 }}>
                            {formatAmount(acc.current_balance)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Buddy tip - tablet right column */}
              <div style={{ margin: '10px 16px 16px', padding: '11px 13px', borderRadius: 'var(--pb-radius)', background: 'var(--pb-brand-pale)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <BuddySVG size={22} mood={buddyMood} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--pb-brand-deep)' }}>Buddy tip</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--pb-brand-deep)', marginTop: 6, lineHeight: 1.45, opacity: 0.85 }}>
                  {txs.length > 0
                    ? `${txs.length} transaction${txs.length !== 1 ? 's' : ''} this month. Keep adding to see spending patterns!`
                    : 'No transactions yet this month. Add your first one using the + button!'}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── FAB ── */}
      <button
        onClick={() => setModalOpen(true)}
        className="fixed mobile-fab-bottom right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-[18px] flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-30"
        style={{ background: 'var(--pb-brand)', color: '#fff', boxShadow: '0 10px 22px color-mix(in srgb, var(--pb-brand) 45%, transparent)' }}
        aria-label="Add transaction"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <TransactionModal open={modalOpen} onClose={() => setModalOpen(false)} categories={categories} accounts={accounts} month={month} />

      <AnimatePresence>
        {editingTx && (
          <ReviewEditDrawer
            key="edit-drawer"
            transaction={editingTx}
            categories={categories}
            accounts={accounts}
            onSave={handleEditSave}
            onClose={() => setEditingTx(null)}
            saving={editSaving}
            mode="edit"
          />
        )}
      </AnimatePresence>

      {/* ── Mobile filter bottom sheet ── */}
      {filterSheetOpen && (
        <>
          <div className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setFilterSheetOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl" style={{ background: 'var(--surface)' }}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
            </div>
            <div className="px-4 pt-2 pb-8 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Filters</h3>
                {hasFilters && (
                  <button type="button" onClick={() => { setSelectedType(null); setSelectedCategory(null); setSelectedAccount(null); setRecurringOnly(false) }} className="text-xs font-medium" style={{ color: 'var(--pb-brand)' }}>
                    Clear all
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>TYPE</span>
                <div className="flex gap-2 flex-wrap">
                  {(['debit', 'credit', 'transfer'] as TransactionType[]).map((type) => {
                    const active = selectedType === type
                    return (
                      <button key={type} type="button" onClick={() => setSelectedType(active ? null : type)} className="px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors" style={active ? { background: TYPE_COLOR[type], color: '#fff' } : { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                        {type}
                      </button>
                    )
                  })}
                </div>
              </div>
              {monthCategories.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>CATEGORY</span>
                  <div className="flex gap-2 flex-wrap">
                    {monthCategories.map((cat) => (
                      <button key={cat} type="button" onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)} className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors" style={selectedCategory === cat ? { background: 'var(--pb-brand)', color: '#fff' } : { background: 'var(--pb-bg)', color: 'var(--pb-ink-2)', border: '1px solid var(--pb-line)' }}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {accounts.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>ACCOUNT</span>
                  <div className="flex gap-2 flex-wrap">
                    {accounts.map((acc) => (
                      <button key={acc.id} type="button" onClick={() => setSelectedAccount(selectedAccount === acc.id ? null : acc.id)} className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors" style={selectedAccount === acc.id ? { background: 'var(--pb-brand)', color: '#fff' } : { background: 'var(--pb-bg)', color: 'var(--pb-ink-2)', border: '1px solid var(--pb-line)' }}>
                        {acc.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>RECURRING</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setRecurringOnly((v) => !v)} className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors" style={recurringOnly ? { background: 'var(--pb-brand)', color: '#fff' } : { background: 'var(--pb-bg)', color: 'var(--pb-ink-2)', border: '1px solid var(--pb-line)' }}>
                    ↻ Recurring only
                  </button>
                </div>
              </div>
              <button type="button" onClick={() => setFilterSheetOpen(false)} className="w-full py-3 rounded-xl text-sm font-semibold mt-1" style={{ background: 'var(--pb-brand)', color: '#fff' }}>
                Done
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Mobile calendar bottom sheet ── */}
      {calSheetOpen && (
        <>
          <div className="fixed inset-0 z-50 md:hidden" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setCalSheetOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl md:hidden" style={{ background: 'var(--surface)' }}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
            </div>
            <div className="px-4 pb-2 pt-1">
              <MonthPicker value={month} onChange={(m) => { setMonth(m); setSelectedDate(null); router.push(`/?month=${m}`) }} />
            </div>
            <CalendarView
              month={month}
              selectedDate={selectedDate}
              onSelectDate={(d) => { setSelectedDate(d); setCalSheetOpen(false) }}
              transactionCounts={txCounts}
            />
            <div className="px-4 pt-2 flex gap-2" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
              {selectedDate && (
                <button onClick={() => { setSelectedDate(null); setCalSheetOpen(false) }} className="flex-1 py-2.5 rounded-xl text-sm" style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                  Show all
                </button>
              )}
              <button onClick={() => setCalSheetOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: 'var(--pb-brand)', color: '#fff' }}>
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
