import type { DuplicateStatus, Transaction } from '@paisa-buddy/shared/types/transaction'
import type { TxInput } from '../repositories/transactionRepository'

export type DuplicateCandidate = {
  status: DuplicateStatus
  duplicateOfTransactionId: string | null
}

export function detectDuplicate(row: TxInput, existingTransactions: Transaction[]): DuplicateCandidate {
  let best: DuplicateCandidate = { status: 'none', duplicateOfTransactionId: null }

  for (const tx of existingTransactions) {
    if (tx.account_id !== row.account_id) continue
    if (tx.amount !== row.amount) continue
    if (tx.type !== row.type) continue

    const sameDate = tx.date === row.date
    const nearbyDate = Math.abs(daysBetween(tx.date, row.date)) <= 1
    const sameRef = hasSameRef(tx, row)
    const sameLookup = !!tx.normalized_lookup_key &&
      !!row.normalized_lookup_key &&
      tx.normalized_lookup_key === row.normalized_lookup_key
    const sameDedupeKey = !!tx.dedupe_key && !!row.dedupe_key && tx.dedupe_key === row.dedupe_key

    if (sameDate && sameRef) {
      return { status: 'confirmed_duplicate', duplicateOfTransactionId: tx.id }
    }

    if (sameDate && sameDedupeKey) {
      return { status: 'confirmed_duplicate', duplicateOfTransactionId: tx.id }
    }

    if ((sameDate || nearbyDate) && sameLookup) {
      best = { status: 'possible_duplicate', duplicateOfTransactionId: tx.id }
    }
  }

  return best
}

function hasSameRef(tx: Transaction, row: TxInput): boolean {
  const existingRef = normalizeRef(tx.upi_ref)
  const importedRef = normalizeRef(row.upi_ref)
  return !!existingRef && existingRef === importedRef
}

function normalizeRef(raw: string | null | undefined): string {
  return (raw ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').trim()
}

function daysBetween(a: string, b: string): number {
  const aTime = new Date(`${a}T00:00:00`).getTime()
  const bTime = new Date(`${b}T00:00:00`).getTime()
  if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) return Number.MAX_SAFE_INTEGER
  return Math.round((aTime - bTime) / 86400000)
}
