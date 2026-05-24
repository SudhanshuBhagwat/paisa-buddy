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
import MonthPicker from '@/components/MonthPicker'
import TransactionList from '@/components/TransactionList'
import TransactionModal from '@/components/TransactionModal'
import CalendarView from '@/components/CalendarView'
import ReviewEditDrawer from '@/app/review/ReviewEditDrawer'
import { updateTransaction } from '@/app/actions/transactions'
import { useScrollLock } from '@/lib/hooks/useScrollLock'

const SUMMARY_ITEMS = (
  income: number,
  expense: number,
  balance: number,
  transfer: number,
) => [
  { label: 'Income', value: income, color: '#16a34a' },
  { label: 'Spent', value: expense, color: '#dc2626' },
  {
    label: 'Balance',
    value: balance,
    color: balance >= 0 ? '#16a34a' : '#dc2626',
  },
  { label: 'Transfers', value: transfer, color: '#2563eb' },
]

interface Props {
  transactions: Transaction[]
  categories: string[]
}

export default function HomeClient({ transactions, categories }: Props) {
  const [month, setMonth] = useState(() => toYearMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<TransactionType | null>(null)
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
    await updateTransaction(editingTx.id, updates)
    setEditSaving(false)
    setEditingTx(null)
  }

  useEffect(() => {
    setSelectedDate(null)
    setSelectedCategory(null)
    setSelectedType(null)
    setSearchQuery('')
  }, [month])

  const txs = getMonthTransactions(transactions, month)
  const q = searchQuery.trim().toLowerCase()
  const filteredTxs = txs.filter(
    (t) =>
      (!selectedDate || t.date === selectedDate) &&
      (!selectedCategory || t.category === selectedCategory) &&
      (!selectedType || t.type === selectedType) &&
      (!q || t.merchant?.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)),
  )
  const { income, expense, balance, transfer } = calcSummary(txs)
  const summaryItems = SUMMARY_ITEMS(income, expense, balance, transfer)

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

  return (
    <main className="w-full pb-36 md:pb-0 md:pt-14 min-h-dvh">
      <div className="md:max-w-5xl md:mx-auto md:grid md:grid-cols-[1fr_320px]">
        {/* ── Cell 1: Desktop summary (top-left) ── */}
        <div
          className="hidden md:block md:border-r md:border-b px-4 py-1.5"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between gap-2 h-full">
            {summaryItems.map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-xl px-3 py-3 flex flex-col gap-1 items-center"
                style={{ background: 'var(--bg)' }}
              >
                <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                  {label}
                </span>
                <span className="text-sm font-semibold tabular-nums" style={{ color }}>
                  {formatAmount(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Cell 2: Desktop MonthPicker (top-right) ── */}
        <div
          className="hidden md:flex md:items-center md:border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="w-full">
            <MonthPicker value={month} onChange={setMonth} txCount={txs.length} />
          </div>
        </div>

        {/* ── Cell 3: Transaction list + all mobile content ── */}
        <div className="md:border-r" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-xl mx-auto md:max-w-none">
            <div className="md:hidden py-2">
              <MonthPicker
                value={month}
                onChange={setMonth}
                onLabelClick={() => setCalSheetOpen(true)}
                txCount={txs.length}
              />
            </div>

            {(() => {
              const balanceColor = balance >= 0 ? '#16a34a' : '#dc2626'
              const balanceFormatted = formatAmount(balance)
              const dotIdx = balanceFormatted.lastIndexOf('.')
              const balInt = dotIdx >= 0 ? balanceFormatted.slice(0, dotIdx) : balanceFormatted
              const balDec = dotIdx >= 0 ? balanceFormatted.slice(dotIdx + 1) : null
              return (
                <div
                  className="md:hidden px-4 pt-3 pb-3 flex flex-col gap-3"
                  style={{ borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)' }}
                >
                  {/* Net balance */}
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--muted)' }}>NET BALANCE</span>
                    <div className="flex items-baseline tabular-nums" style={{ color: balanceColor }}>
                      <span className="text-3xl font-bold">{balInt}</span>
                      {balDec && <span className="text-lg font-semibold">.{balDec}</span>}
                    </div>
                  </div>
                  {/* Secondary: income / spent / transfers */}
                  <div className="grid grid-cols-3">
                    {[
                      { label: 'INCOME', value: income, color: '#16a34a' },
                      { label: 'SPENT', value: expense, color: '#dc2626' },
                      { label: 'TRANSFERS', value: transfer, color: '#2563eb' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--muted)' }}>{label}</span>
                        <span className="text-sm font-semibold tabular-nums" style={{ color }}>{formatAmount(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

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
                  <div
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{ background: '#dc2626', color: '#fff' }}
                  >
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
            <div className="px-4 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
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
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                )}
              </div>
              {txs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterSheetOpen(true)}
                  className="md:hidden relative shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{
                    background: (selectedType || selectedCategory) ? 'var(--text)' : 'var(--bg)',
                    border: '1px solid var(--border)',
                    color: (selectedType || selectedCategory) ? 'var(--bg)' : 'var(--muted)',
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

            {/* Type filter */}
            {txs.length > 0 && (
              <div
                className="hidden md:flex items-center gap-2 px-4 py-3 overflow-x-auto"
                style={{ borderBottom: '1px solid var(--border)', scrollbarWidth: 'none' }}
              >
                <span className="shrink-0 text-sm font-bold pr-1" style={{ color: 'var(--muted)' }}>Filter by Type:</span>
                {(['debit', 'credit', 'transfer'] as TransactionType[]).map((type) => {
                  const COLOR: Record<TransactionType, string> = { debit: '#dc2626', credit: '#16a34a', transfer: '#2563eb' }
                  const active = selectedType === type
                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedType(active ? null : type)}
                      className="shrink-0 px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors"
                      style={active
                        ? { background: COLOR[type], color: '#fff' }
                        : { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }
                      }
                    >
                      {type}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Category filter */}
            {monthCategories.length > 0 && (
              <div
                className="hidden md:flex items-center gap-2 px-4 py-3 overflow-x-auto"
                style={{ borderBottom: '1px solid var(--border)', scrollbarWidth: 'none' }}
              >
                <span className="shrink-0 text-sm font-bold pr-1" style={{ color: 'var(--muted)' }}>Filter by Category:</span>
                {monthCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                    className="shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors"
                    style={selectedCategory === cat
                      ? { background: '#dc2626', color: '#fff' }
                      : { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }
                    }
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {selectedDate && (
              <div
                className="flex items-center justify-between px-4 py-2 text-xs"
                style={{
                  background: 'var(--bg)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span style={{ color: 'var(--muted)' }}>
                  Showing {formatDateLabel(selectedDate)}
                </span>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="font-medium"
                  style={{ color: 'var(--text)' }}
                >
                  Show all
                </button>
              </div>
            )}

            <TransactionList transactions={filteredTxs} onEdit={setEditingTx} />
          </div>
        </div>

        {/* ── Cell 4: Calendar (bottom-right, desktop only) ── */}
        <div className="hidden md:block">
          <div
            className="sticky top-14"
            style={{ maxHeight: 'calc(100dvh - 3.5rem)', overflowY: 'auto' }}
          >
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
                  style={{
                    background: 'var(--bg)',
                    color: 'var(--muted)',
                    border: '1px solid var(--border)',
                  }}
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
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <TransactionModal open={modalOpen} onClose={() => setModalOpen(false)} categories={categories} />

      {editingTx && (
        <ReviewEditDrawer
          transaction={editingTx}
          categories={categories}
          onSave={handleEditSave}
          onClose={() => setEditingTx(null)}
          saving={editSaving}
          mode="edit"
        />
      )}

      {/* ── Mobile filter bottom sheet ── */}
      {filterSheetOpen && (
        <>
          <div
            className="fixed inset-0 z-50 md:hidden"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setFilterSheetOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl md:hidden"
            style={{ background: 'var(--surface)' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
            </div>
            <div className="px-4 pt-2 pb-8 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Filters</h3>
                {(selectedType || selectedCategory) && (
                  <button
                    type="button"
                    onClick={() => { setSelectedType(null); setSelectedCategory(null) }}
                    className="text-xs font-medium"
                    style={{ color: '#dc2626' }}
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Type */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>TYPE</span>
                <div className="flex gap-2 flex-wrap">
                  {(['debit', 'credit', 'transfer'] as TransactionType[]).map((type) => {
                    const COLOR: Record<TransactionType, string> = { debit: '#dc2626', credit: '#16a34a', transfer: '#2563eb' }
                    const active = selectedType === type
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setSelectedType(active ? null : type)}
                        className="px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors"
                        style={active
                          ? { background: COLOR[type], color: '#fff' }
                          : { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }
                        }
                      >
                        {type}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Category */}
              {monthCategories.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>CATEGORY</span>
                  <div className="flex gap-2 flex-wrap">
                    {monthCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                        className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
                        style={selectedCategory === cat
                          ? { background: 'var(--text)', color: 'var(--bg)' }
                          : { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }
                        }
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setFilterSheetOpen(false)}
                className="w-full py-3 rounded-xl text-sm font-semibold mt-1"
                style={{ background: 'var(--text)', color: 'var(--bg)' }}
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Mobile calendar bottom sheet ── */}
      {calSheetOpen && (
        <>
          <div
            className="fixed inset-0 z-50 md:hidden"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setCalSheetOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl md:hidden"
            style={{ background: 'var(--surface)' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
            </div>
            <div className="px-4 pb-2 pt-1">
              <MonthPicker
                value={month}
                onChange={(m) => {
                  setMonth(m)
                  setSelectedDate(null)
                }}
              />
            </div>
            <CalendarView
              month={month}
              selectedDate={selectedDate}
              onSelectDate={(d) => {
                setSelectedDate(d)
                setCalSheetOpen(false)
              }}
              transactionCounts={txCounts}
            />
            <div className="px-4 pb-6 pt-2 flex gap-2">
              {selectedDate && (
                <button
                  onClick={() => {
                    setSelectedDate(null)
                    setCalSheetOpen(false)
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm"
                  style={{
                    background: 'var(--bg)',
                    color: 'var(--muted)',
                    border: '1px solid var(--border)',
                  }}
                >
                  Show all
                </button>
              )}
              <button
                onClick={() => setCalSheetOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: 'var(--text)', color: 'var(--bg)' }}
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
