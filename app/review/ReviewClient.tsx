'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useScrollLock } from '@/lib/hooks/useScrollLock'
import {
  rejectTransaction,
  updateAndConfirmTransaction,
} from '@/app/actions/transactions'
import ConfirmModal from '@/components/ConfirmModal'
import ReviewEditDrawer from './ReviewEditDrawer'
import type { Transaction } from '@/lib/types/transaction'
import type { Account } from '@/lib/types/account'

interface Props {
  transactions: Transaction[]
  categories: string[]
  accounts: Account[]
}

const TYPE_COLOR: Record<string, string> = {
  debit: '#dc2626',
  credit: '#16a34a',
  transfer: '#2563eb',
}

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low confidence',
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high: '#16a34a',
  medium: '#d97706',
  low: '#dc2626',
}

function formatAmount(paise: number): string {
  return (paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
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

export default function ReviewClient({ transactions, categories, accounts }: Props) {
  const router = useRouter()
  const prevLengthRef = useRef(transactions.length)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  useScrollLock(editingTx !== null)

  useEffect(() => {
    const prev = prevLengthRef.current
    prevLengthRef.current = transactions.length
    if (transactions.length === 0 && prev > 0) {
      const t = setTimeout(() => router.push('/'), 1500)
      return () => clearTimeout(t)
    }
  }, [transactions.length, router])

  async function handleReject() {
    if (!rejectingId) return
    setLoading(rejectingId)
    try {
      await rejectTransaction(rejectingId)
      setRejectingId(null)
    } finally {
      setLoading(null)
    }
  }

  async function handleSaveEdit(id: string, updates: Partial<Omit<Transaction, 'id' | 'created_at'>>) {
    setLoading(id)
    try {
      await updateAndConfirmTransaction(id, updates)
      setEditingTx(null)
    } finally {
      setLoading(null)
    }
  }

  if (transactions.length === 0) {
    return (
      <main className="max-w-xl md:max-w-2xl mx-auto w-full min-h-dvh pb-20 md:pt-14 px-4 flex flex-col items-center justify-center gap-3">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)' }}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <p className="text-base font-medium">All caught up</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>No receipts waiting for review</p>
      </main>
    )
  }

  return (
    <main className="max-w-xl md:max-w-2xl mx-auto w-full min-h-dvh pb-20 md:pt-14 px-4">
      <div className="py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="md:hidden p-1 -ml-1 rounded-lg"
            style={{ color: 'var(--muted)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold">Review</h1>
        </div>
        <span className="text-sm px-2 py-0.5 rounded-full font-medium" style={{ background: '#dc2626', color: '#fff' }}>
          {transactions.length}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {transactions.map((tx) => {
          const categoryHint = getCategoryHint(tx)
          const typeColor = TYPE_COLOR[tx.type] ?? 'var(--text)'
          const isProcessing = loading === tx.id

          return (
            <div
              key={tx.id}
              className="rounded-xl"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', opacity: isProcessing ? 0.6 : 1 }}
            >
              {/* Card header */}
              <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                      style={{ background: `${typeColor}18`, color: typeColor }}
                    >
                      {tx.type}
                    </span>
                    {tx.confidence && tx.confidence !== 'high' && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: `${CONFIDENCE_COLOR[tx.confidence]}18`, color: CONFIDENCE_COLOR[tx.confidence] }}
                      >
                        {CONFIDENCE_LABEL[tx.confidence]}
                      </span>
                    )}
                  </div>
                  <span
                    className="text-2xl font-semibold tabular-nums"
                    style={{ color: typeColor }}
                  >
                    ₹{formatAmount(tx.amount)}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>
                    {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  {tx.time && (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{tx.time}</div>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="px-4 pb-3 flex flex-col gap-1">
                {tx.merchant && (
                  <p className="text-sm font-medium truncate">{tx.merchant}</p>
                )}
                <p className="text-sm truncate" style={{ color: tx.merchant ? 'var(--muted)' : 'var(--text)' }}>
                  {tx.description}
                </p>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  {tx.bank && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                      {tx.bank}
                    </span>
                  )}
                  {categoryHint && !tx.category && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px dashed var(--border)' }}>
                      AI: {categoryHint}
                    </span>
                  )}
                  {tx.category && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                      {tx.category}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex border-t" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setRejectingId(tx.id)}
                  disabled={isProcessing}
                  className="flex-1 flex items-center justify-center min-h-[52px] text-sm font-medium active:opacity-60 disabled:opacity-40 cursor-pointer rounded-bl-xl"
                  style={{ color: '#dc2626', touchAction: 'manipulation' }}
                >
                  Reject
                </button>
                <div aria-hidden className="w-px shrink-0" style={{ background: 'var(--border)' }} />
                <button
                  type="button"
                  onClick={() => setEditingTx(tx)}
                  disabled={isProcessing}
                  className="flex-1 flex items-center justify-center min-h-[52px] text-sm font-semibold active:opacity-60 disabled:opacity-40 cursor-pointer rounded-br-xl"
                  style={{ color: '#16a34a', touchAction: 'manipulation' }}
                >
                  {isProcessing ? '…' : 'Edit & Confirm'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <ConfirmModal
        open={rejectingId !== null}
        title="Reject this transaction?"
        message="The receipt data will be permanently deleted."
        confirmLabel="Reject"
        confirmColor="#dc2626"
        onConfirm={handleReject}
        onCancel={() => setRejectingId(null)}
      />

      {editingTx && (
        <ReviewEditDrawer
          transaction={editingTx}
          categories={categories}
          accounts={accounts}
          onSave={(updates) => handleSaveEdit(editingTx.id, updates)}
          onClose={() => setEditingTx(null)}
          saving={loading === editingTx.id}
        />
      )}
    </main>
  )
}
