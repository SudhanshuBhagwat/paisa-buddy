'use client'

import { useState } from 'react'
import { formatAmount } from '@/lib/utils'
import { deleteTransaction } from '@/app/actions/transactions'
import ConfirmModal from './ConfirmModal'
import { categoryColor } from '@/lib/categories'
import type { Transaction } from '@/lib/types/transaction'

const TYPE_COLOR: Record<string, string> = {
  credit: 'var(--pb-pos)',
  debit: 'var(--pb-neg)',
  transfer: 'var(--pb-transfer)',
}

const TYPE_PREFIX: Record<string, string> = {
  credit: '+',
  debit: '−',
  transfer: '⇄',
}

interface Props {
  tx: Transaction
  onEdit?: (tx: Transaction) => void
}

export default function TransactionItem({ tx, onEdit }: Props) {
  const typeColor = TYPE_COLOR[tx.type]
  const catColor = categoryColor(tx.category)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleConfirmDelete() {
    setConfirmOpen(false)
    await deleteTransaction(tx.id)
  }

  return (
    <>
      <div
        className="flex items-center gap-3 px-4"
        style={{
          padding: 'var(--pb-row-pad) 16px',
          borderBottom: '1px solid var(--pb-line)',
          cursor: onEdit ? 'pointer' : undefined,
        }}
        onClick={onEdit ? () => onEdit(tx) : undefined}
      >
        {/* Category dot */}
        <div
          className="shrink-0 rounded-full"
          style={{ width: 10, height: 10, background: catColor }}
        />

        <div className="flex-1 min-w-0 flex flex-col">
          <span
            className="text-sm truncate"
            style={{ color: 'var(--pb-ink)', fontWeight: 600 }}
          >
            {tx.merchant || tx.description || '—'}
          </span>
          <span className="text-xs truncate" style={{ color: 'var(--pb-ink-3)', marginTop: 1 }}>
            {tx.category && (
              <span style={{ color: catColor, fontWeight: 700 }}>{tx.category}</span>
            )}
            {tx.category && tx.description && tx.merchant && ' · '}
            {tx.merchant ? tx.description : null}
          </span>
        </div>

        {tx.is_recurring && (
          <span
            className="shrink-0 text-xs font-semibold"
            title="Recurring"
            style={{ color: 'var(--pb-ink-3)' }}
          >
            ↻
          </span>
        )}

        {tx.account_id === null && (
          <div
            className="shrink-0 w-1.5 h-1.5 rounded-full"
            title="No account assigned"
            style={{ background: 'var(--pb-gold)' }}
          />
        )}

        <div
          className="shrink-0 flex items-center gap-1 text-sm font-bold tabular-nums"
          style={{
            color: typeColor,
            fontFamily: '"Space Mono", var(--font-space-mono, monospace)',
          }}
        >
          <span>{TYPE_PREFIX[tx.type]}</span>
          <span>{formatAmount(tx.amount)}</span>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); setConfirmOpen(true) }}
          className="shrink-0 p-1 rounded transition-opacity hover:opacity-60"
          style={{ color: 'var(--pb-ink-3)' }}
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

      <ConfirmModal
        open={confirmOpen}
        title="Delete transaction?"
        message="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
