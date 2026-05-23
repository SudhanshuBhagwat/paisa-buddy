'use client'

import { groupByCategory, formatAmount } from '@/lib/utils'
import type { Transaction } from '@/lib/types/transaction'

interface Props {
  transactions: Transaction[]
}

function CategoryBars({
  categories,
  total,
  color,
}: {
  categories: { category: string; total: number }[]
  total: number
  color: string
}) {
  if (categories.length === 0) return null
  return (
    <div className="flex flex-col gap-3">
      {categories.map(({ category, total: catTotal }) => {
        const pct = total > 0 ? (catTotal / total) * 100 : 0
        return (
          <div key={category} className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm">
              <span>{category}</span>
              <span className="tabular-nums font-medium">{formatAmount(catTotal)}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: color, transition: 'width 0.4s ease' }}
              />
            </div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              {pct.toFixed(0)}% of total
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function StatsView({ transactions: txs }: Props) {
  const totalSpent = txs.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0)
  const totalIncome = txs.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0)
  const totalTransfer = txs.filter((t) => t.type === 'transfer').reduce((s, t) => s + t.amount, 0)
  const expenseCategories = groupByCategory(txs, 'debit')
  const incomeCategories = groupByCategory(txs, 'credit')
  const transferCategories = groupByCategory(txs, 'transfer')

  if (txs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--muted)' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        <span className="text-sm">No data this month</span>
      </div>
    )
  }

  return (
    <div className="px-4 pb-6 flex flex-col gap-6">
      {/* Summary cards — 2×2 grid */}
      <div className="grid grid-cols-2 gap-3 pt-4">
        <div className="rounded-xl p-4 flex flex-col gap-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Income</span>
          <span className="text-base font-semibold tabular-nums" style={{ color: '#16a34a' }}>{formatAmount(totalIncome)}</span>
        </div>
        <div className="rounded-xl p-4 flex flex-col gap-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Spent</span>
          <span className="text-base font-semibold tabular-nums" style={{ color: '#dc2626' }}>{formatAmount(totalSpent)}</span>
        </div>
        <div className="rounded-xl p-4 flex flex-col gap-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Balance</span>
          <span
            className="text-base font-semibold tabular-nums"
            style={{ color: totalIncome - totalSpent >= 0 ? '#16a34a' : '#dc2626' }}
          >
            {formatAmount(totalIncome - totalSpent)}
          </span>
        </div>
        <div className="rounded-xl p-4 flex flex-col gap-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Transfers</span>
          <span className="text-base font-semibold tabular-nums" style={{ color: '#2563eb' }}>{formatAmount(totalTransfer)}</span>
        </div>
      </div>

      {/* Expense breakdown */}
      {expenseCategories.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-medium" style={{ color: 'var(--muted)' }}>EXPENSES BY CATEGORY</h3>
          <CategoryBars categories={expenseCategories} total={totalSpent} color="#dc2626" />
        </div>
      )}

      {/* Income breakdown */}
      {incomeCategories.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-medium" style={{ color: 'var(--muted)' }}>INCOME BY CATEGORY</h3>
          <CategoryBars categories={incomeCategories} total={totalIncome} color="#16a34a" />
        </div>
      )}

      {/* Transfer breakdown */}
      {transferCategories.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-medium" style={{ color: 'var(--muted)' }}>TRANSFERS BY CATEGORY</h3>
          <CategoryBars categories={transferCategories} total={totalTransfer} color="#2563eb" />
        </div>
      )}
    </div>
  )
}
