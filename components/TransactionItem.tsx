'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatAmount } from '@/lib/utils'
import { deleteTransaction } from '@/app/actions/transactions'
import ConfirmModal from './ConfirmModal'
import type { Transaction } from '@/lib/types/transaction'

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
  const router = useRouter()
  const color = TYPE_COLORS[tx.type]
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleConfirmDelete() {
    setConfirmOpen(false)
    await deleteTransaction(tx.id)
    router.refresh()
  }

  return (
    <>
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />

        <div className="flex-1 min-w-0 text-sm truncate" style={{ color: tx.description ? 'var(--text)' : 'var(--muted)' }}>
          {tx.description || '—'}
        </div>

        <span
          className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ border: `1px solid ${color}`, color, background: 'transparent' }}
        >
          {tx.category ?? 'Uncategorized'}
        </span>

        <div className="flex items-center gap-1 text-sm font-semibold shrink-0 tabular-nums" style={{ color }}>
          <span>{TYPE_PREFIX[tx.type]}</span>
          <span>{formatAmount(tx.amount)}</span>
        </div>

        <button
          onClick={() => setConfirmOpen(true)}
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
