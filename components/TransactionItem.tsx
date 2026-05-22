'use client'

import { useStore } from '@/lib/store'
import { formatAmount } from '@/lib/utils'
import type { Transaction } from '@/lib/types'

const TYPE_COLORS: Record<string, string> = {
  credit: '#16a34a',
  debit: '#dc2626',
  transfer: '#2563eb',
}

const TYPE_PREFIX: Record<string, string> = {
  credit: '+',
  debit: '−',
  transfer: '⇄',
}

interface Props {
  tx: Transaction
}

export default function TransactionItem({ tx }: Props) {
  const { dispatch } = useStore()
  const color = TYPE_COLORS[tx.type]

  function handleDelete() {
    if (confirm('Delete this transaction?')) {
      dispatch({ type: 'DELETE_TX', payload: tx.id })
    }
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />

      {/* Notes — left */}
      <div className="flex-1 min-w-0 text-sm truncate" style={{ color: tx.notes ? 'var(--text)' : 'var(--muted)' }}>
        {tx.notes || '—'}
      </div>

      {/* Category pill — bordered, transparent bg */}
      <span
        className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ border: `1px solid ${color}`, color, background: 'transparent' }}
      >
        {tx.category}
      </span>

      {/* Amount — prefix + number with gap */}
      <div className="flex items-center gap-1 text-sm font-semibold shrink-0 tabular-nums" style={{ color }}>
        <span>{TYPE_PREFIX[tx.type]}</span>
        <span>{formatAmount(tx.amount)}</span>
      </div>

      {/* Delete */}
      <button
        onClick={handleDelete}
        className="shrink-0 p-1 rounded transition-opacity hover:opacity-60"
        style={{ color: 'var(--muted)' }}
        aria-label="Delete transaction"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      </button>
    </div>
  )
}
