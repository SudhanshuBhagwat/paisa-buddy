'use client'

import { groupByDate, formatDateLabel } from '@/lib/utils'
import type { Transaction } from '@/lib/types/transaction'
import TransactionItem from './TransactionItem'

interface Props {
  transactions: Transaction[]
  onEdit?: (tx: Transaction) => void
  compact?: boolean
}

export default function TransactionList({ transactions, onEdit, compact }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--muted)' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
        <span className="text-sm">No transactions this month</span>
      </div>
    )
  }

  const grouped = groupByDate(transactions)
  const dates = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a))

  return (
    <div>
      {dates.map((date) => (
        <div key={date}>
          <div
            className="px-4 py-2 text-xs font-medium"
            style={{ color: 'var(--muted)', background: compact ? 'transparent' : 'var(--bg)' }}
          >
            {formatDateLabel(date)}
          </div>
          {grouped.get(date)!.map((tx) => (
            <TransactionItem key={tx.id} tx={tx} onEdit={onEdit} />
          ))}
        </div>
      ))}
    </div>
  )
}
