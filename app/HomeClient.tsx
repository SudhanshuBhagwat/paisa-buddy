'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Transaction } from '@/lib/types/transaction'
import {
  toYearMonth,
  getMonthTransactions,
  calcSummary,
  formatAmount,
  formatDateLabel,
} from '@/lib/utils'
import type { TransactionType } from '@/lib/types/transaction'
import type { AccountWithBalance } from '@/lib/types/account'
import MonthPicker from '@/components/MonthPicker'
import TransactionList from '@/components/TransactionList'
import TransactionModal from '@/components/TransactionModal'
import CalendarView from '@/components/CalendarView'
import ReviewEditDrawer from '@/app/review/ReviewEditDrawer'
import { updateTransaction } from '@/app/actions/transactions'
import { useScrollLock } from '@/lib/hooks/useScrollLock'

const TYPE_COLOR: Record<TransactionType, string> = {
  debit: '#dc2626',
  credit: '#16a34a',
  transfer: '#2563eb',
}

interface Props {
  transactions: Transaction[]
  categories: string[]
  accounts: AccountWithBalance[]
}

export default function HomeClient({ transactions, categories, accounts }: Props) {
  const [month, setMonth] = useState(() => toYearMonth(new Date()))
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

  useScrollLock(calSheetOpen || filterSheetOpen || editingTx !== null)

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

  const txs = getMonthTransactions(transactions, month)
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

  // Balance display — shared by mobile stats and desktop sidebar
  const balanceColor = balance >= 0 ? '#16a34a' : '#dc2626'
  const balFormatted = formatAmount(balance)
  const balDotIdx = balFormatted.lastIndexOf('.')
  const balInt = balDotIdx >= 0 ? balFormatted.slice(0, balDotIdx) : balFormatted
  const balDec = balDotIdx >= 0 ? balFormatted.slice(balDotIdx + 1) : null

  const txCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const tx of txs) map.set(tx.date, (map.get(tx.date) ?? 0) + 1)
    return map
  }, [txs])

  const monthCategories = useMemo(
    () =>
      Array.from(new Set(txs.map((t) => t.category).filter((c): c is string => c !== null))).sort(),
    [txs],
  )

  const statsRows = [
    { label: 'INCOME', value: income, color: '#16a34a' },
    { label: 'SPENT', value: expense, color: '#dc2626' },
    { label: 'TRANSFERS', value: transfer, color: '#2563eb' },
  ]

  return (
    <main className="w-full pb-36 md:pb-0 md:pt-14 min-h-dvh">
      <div className="md:grid md:grid-cols-[1fr_320px] lg:grid-cols-[300px_1fr_300px]">

        {/* ══ Column 1 (lg+ only): Stats + Filters sidebar ══ */}
        <aside className="hidden lg:flex flex-col border-r" style={{ borderColor: 'var(--border)' }}>
          <div
            className="sticky top-14 pt-3 pb-4 flex flex-col"
            style={{ maxHeight: 'calc(100dvh - 3.5rem)', overflowY: 'auto' }}
          >
            {/* Net balance + stats (no separator between them) */}
            <div className="pl-3 pr-5 pb-4 flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--muted)' }}>NET BALANCE</span>
                <div className="flex items-baseline tabular-nums" style={{ color: balanceColor }}>
                  <span className="text-2xl font-bold">{balInt}</span>
                  {balDec && <span className="text-base font-semibold">.{balDec}</span>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {statsRows.map(({ label, value, color }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--muted)' }}>{label}</span>
                    <span className="text-xs font-semibold tabular-nums" style={{ color }}>{formatAmount(value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Accounts */}
            {accounts.length > 0 && (
              <>
                <div style={{ borderTop: '1px solid var(--border)' }} />
                <div className="pl-3 pr-5 pt-4 pb-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold tracking-wide" style={{ color: 'var(--muted)' }}>ACCOUNTS</p>
                    <Link href="/accounts" className="text-xs" style={{ color: 'var(--muted)' }}>Manage</Link>
                  </div>
                  {accounts.map((acc) => {
                    const balColor = acc.current_balance >= 0 ? '#16a34a' : '#dc2626'
                    return (
                      <div key={acc.id} className="flex items-center justify-between gap-2">
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-medium truncate">{acc.name}</span>
                          {acc.bank && <span className="text-xs truncate" style={{ color: 'var(--muted)' }}>{acc.bank}</span>}
                        </div>
                        <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color: balColor }}>
                          {formatAmount(acc.current_balance)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Filters */}
            {(txs.length > 0 || monthCategories.length > 0) && (
              <>
                <div style={{ borderTop: '1px solid var(--border)' }} />
                <div className="pl-3 pr-5 pt-4 pb-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold tracking-wide" style={{ color: 'var(--muted)' }}>FILTERS</p>
                    {(selectedType || selectedCategory || selectedAccount || recurringOnly) && (
                      <button type="button" onClick={() => { setSelectedType(null); setSelectedCategory(null); setSelectedAccount(null); setRecurringOnly(false) }} className="text-xs font-medium" style={{ color: '#dc2626' }}>
                        Clear
                      </button>
                    )}
                  </div>
                  <select
                    value={selectedType ?? ''}
                    onChange={(e) => setSelectedType((e.target.value as TransactionType) || null)}
                    className="px-3 py-2 rounded-lg text-xs outline-none"
                    style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  >
                    <option value="">All types</option>
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                    <option value="transfer">Transfer</option>
                  </select>
                  {monthCategories.length > 0 && (
                    <select
                      value={selectedCategory ?? ''}
                      onChange={(e) => setSelectedCategory(e.target.value || null)}
                      className="px-3 py-2 rounded-lg text-xs outline-none"
                      style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                    >
                      <option value="">All categories</option>
                      {monthCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  )}
                  {accounts.length > 0 && (
                    <select
                      value={selectedAccount ?? ''}
                      onChange={(e) => setSelectedAccount(e.target.value || null)}
                      className="px-3 py-2 rounded-lg text-xs outline-none"
                      style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                    >
                      <option value="">All accounts</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  )}
                  <select
                    value={recurringOnly ? 'recurring' : ''}
                    onChange={(e) => setRecurringOnly(e.target.value === 'recurring')}
                    className="px-3 py-2 rounded-lg text-xs outline-none"
                    style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  >
                    <option value="">All transactions</option>
                    <option value="recurring">Recurring only</option>
                  </select>
                </div>
              </>
            )}

            {/* Filtered summary */}
            {(selectedType || selectedCategory || selectedAccount || recurringOnly) && (() => {
              const { income, expense, transfer } = calcSummary(filteredTxs)
              const filteredRows = [
                { label: 'INCOME', value: income, color: '#16a34a' },
                { label: 'SPENT', value: expense, color: '#dc2626' },
                { label: 'TRANSFERS', value: transfer, color: '#2563eb' },
              ].filter(({ value }) => value > 0)
              return (
                <>
                  <div style={{ borderTop: '1px solid var(--border)' }} />
                  <div className="pl-3 pr-5 pt-4 pb-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold tracking-wide" style={{ color: 'var(--muted)' }}>SELECTION</p>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>{filteredTxs.length} txn{filteredTxs.length !== 1 ? 's' : ''}</span>
                    </div>
                    {filteredRows.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {filteredRows.map(({ label, value, color }) => (
                          <div key={label} className="flex items-center justify-between">
                            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{label}</span>
                            <span className="text-xs font-semibold tabular-nums" style={{ color }}>{formatAmount(value)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>No transactions</p>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
        </aside>

        {/* ══ Column 2: Main content ══ */}
        <div className="md:border-r" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-xl mx-auto md:max-w-none">

            {/* MonthPicker: mobile only (tablet/desktop is in calendar column) */}
            <div className="md:hidden py-2">
              <MonthPicker
                value={month}
                onChange={setMonth}
                onLabelClick={() => setCalSheetOpen(true)}
                txCount={txs.length}
              />
            </div>

            {/* Mobile stats */}
            <div
              className="md:hidden px-4 pt-3 pb-3 flex flex-col gap-3"
              style={{ borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)' }}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--muted)' }}>NET BALANCE</span>
                <div className="flex items-baseline tabular-nums" style={{ color: balanceColor }}>
                  <span className="text-3xl font-bold">{balInt}</span>
                  {balDec && <span className="text-lg font-semibold">.{balDec}</span>}
                </div>
              </div>
              <div className="grid grid-cols-3">
                {statsRows.map(({ label, value, color }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--muted)' }}>{label}</span>
                    <span className="text-sm font-semibold tabular-nums" style={{ color }}>{formatAmount(value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* iPad stats: tablet only (md, not lg) */}
            <div
              className="hidden md:grid lg:hidden grid-cols-4 gap-4 px-3 py-3"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              {[
                { label: 'Income', value: income, color: '#16a34a' },
                { label: 'Spent', value: expense, color: '#dc2626' },
                { label: 'Balance', value: balance, color: balanceColor },
                { label: 'Transfers', value: transfer, color: '#2563eb' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{label}</span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color }}>{formatAmount(value)}</span>
                </div>
              ))}
            </div>

            {/* Pending review banner (mobile only) */}
            {(() => {
              const pendingCount = transactions.filter((t) => !t.reviewed).length
              if (pendingCount === 0) return null
              return (
                <Link
                  href="/review"
                  className="md:hidden flex items-center gap-3 px-4 py-3"
                  style={{ background: '#dc262612', borderBottom: '1px solid #dc262630' }}
                >
                  <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: '#dc2626', color: '#fff' }}>
                    {pendingCount}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: '#dc2626' }}>Receipts pending review</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>Screenshot imports need confirmation</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#dc2626', flexShrink: 0 }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
              )
            })()}

            {/* Search */}
            <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
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
              {/* Filter button: mobile only */}
              {txs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterSheetOpen(true)}
                  className="md:hidden relative shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{
                    background: (selectedType || selectedCategory || recurringOnly) ? 'var(--text)' : 'var(--bg)',
                    border: '1px solid var(--border)',
                    color: (selectedType || selectedCategory || recurringOnly) ? 'var(--bg)' : 'var(--muted)',
                  }}
                  aria-label="Open filters"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                    <line x1="11" y1="18" x2="13" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* Type filter: tablet only (md, not lg) */}
            {txs.length > 0 && (
              <div className="hidden md:flex lg:hidden items-center gap-2 px-3 py-3 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)', scrollbarWidth: 'none' }}>
                <span className="shrink-0 text-sm font-bold pr-1" style={{ color: 'var(--muted)' }}>Filter by Type:</span>
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

            {/* Category filter: tablet only (md, not lg) */}
            {monthCategories.length > 0 && (
              <div className="hidden md:flex lg:hidden items-center gap-2 px-3 py-3 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)', scrollbarWidth: 'none' }}>
                <span className="shrink-0 text-sm font-bold pr-1" style={{ color: 'var(--muted)' }}>Filter by Category:</span>
                {monthCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                    className="shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors"
                    style={selectedCategory === cat ? { background: '#dc2626', color: '#fff' } : { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
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

            <TransactionList transactions={filteredTxs} onEdit={setEditingTx} />
          </div>
        </div>

        {/* ══ Column 3: Calendar + MonthPicker (tablet + desktop, right side) ══ */}
        <div className="hidden md:block">
          <div className="sticky top-14" style={{ maxHeight: 'calc(100dvh - 3.5rem)', overflowY: 'auto' }}>
            <div className="py-[6px]" style={{ borderBottom: '1px solid var(--border)' }}>
              <MonthPicker value={month} onChange={setMonth} txCount={txs.length} />
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
          </div>
        </div>

      </div>

      {/* ── FAB ── */}
      <button
        onClick={() => setModalOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 z-30"
        style={{ background: 'var(--text)', color: 'var(--bg)' }}
        aria-label="Add transaction"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <TransactionModal open={modalOpen} onClose={() => setModalOpen(false)} categories={categories} accounts={accounts} />

      {editingTx && (
        <ReviewEditDrawer
          transaction={editingTx}
          categories={categories}
          accounts={accounts}
          onSave={handleEditSave}
          onClose={() => setEditingTx(null)}
          saving={editSaving}
          mode="edit"
        />
      )}

      {/* ── Mobile filter bottom sheet ── */}
      {filterSheetOpen && (
        <>
          <div className="fixed inset-0 z-50 md:hidden" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setFilterSheetOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl md:hidden" style={{ background: 'var(--surface)' }}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
            </div>
            <div className="px-4 pt-2 pb-8 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Filters</h3>
                {(selectedType || selectedCategory || selectedAccount || recurringOnly) && (
                  <button type="button" onClick={() => { setSelectedType(null); setSelectedCategory(null); setSelectedAccount(null); setRecurringOnly(false) }} className="text-xs font-medium" style={{ color: '#dc2626' }}>
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
                      <button key={cat} type="button" onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)} className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors" style={selectedCategory === cat ? { background: 'var(--text)', color: 'var(--bg)' } : { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}>
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
                      <button key={acc.id} type="button" onClick={() => setSelectedAccount(selectedAccount === acc.id ? null : acc.id)} className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors" style={selectedAccount === acc.id ? { background: 'var(--text)', color: 'var(--bg)' } : { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                        {acc.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>RECURRING</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setRecurringOnly((v) => !v)} className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors" style={recurringOnly ? { background: 'var(--text)', color: 'var(--bg)' } : { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                    ↻ Recurring only
                  </button>
                </div>
              </div>
              <button type="button" onClick={() => setFilterSheetOpen(false)} className="w-full py-3 rounded-xl text-sm font-semibold mt-1" style={{ background: 'var(--text)', color: 'var(--bg)' }}>
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
              <MonthPicker value={month} onChange={(m) => { setMonth(m); setSelectedDate(null) }} />
            </div>
            <CalendarView
              month={month}
              selectedDate={selectedDate}
              onSelectDate={(d) => { setSelectedDate(d); setCalSheetOpen(false) }}
              transactionCounts={txCounts}
            />
            <div className="px-4 pb-6 pt-2 flex gap-2">
              {selectedDate && (
                <button onClick={() => { setSelectedDate(null); setCalSheetOpen(false) }} className="flex-1 py-2.5 rounded-xl text-sm" style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                  Show all
                </button>
              )}
              <button onClick={() => setCalSheetOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: 'var(--text)', color: 'var(--bg)' }}>
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
