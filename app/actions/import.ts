'use server'

import { updateTag, refresh } from 'next/cache'
import { db } from '@/lib/db'
import { getRequiredUserId } from '@/lib/auth/require-user'
import { buildExistingFingerprints, txFingerprint } from '@/lib/import/dedup'
import { parseStatementText } from '@/lib/import/aiParsing'
import type { TransactionType } from '@/lib/types/transaction'

export interface ImportRow {
  date: string          // YYYY-MM-DD
  type: TransactionType
  amount_paise: number  // integer paise
  description: string
  upi_ref: string | null
}

export async function batchImportTransactions(
  rows: ImportRow[],
  accountId: string,
): Promise<{ count: number; skipped: number }> {
  const userId = await getRequiredUserId()
  return insertRows(userId, rows, accountId)
}

/**
 * For encrypted PDFs: text is extracted client-side with PDF.js (password never
 * leaves the browser), then sent here for AI parsing and insertion.
 */
export async function batchImportFromText(
  statementText: string,
  accountId: string,
): Promise<{ count: number; skipped: number }> {
  const userId = await getRequiredUserId()

  const aiTxs = await parseStatementText(statementText)
  const rows: ImportRow[] = aiTxs.map((tx) => ({
    date: tx.date.slice(0, 10),
    type: tx.type,
    amount_paise: Math.round(tx.amount * 100),
    description: tx.description,
    upi_ref: tx.reference,
  }))

  return insertRows(userId, rows, accountId)
}

async function insertRows(
  userId: string,
  rows: ImportRow[],
  accountId: string,
): Promise<{ count: number; skipped: number }> {
  const existing = await buildExistingFingerprints(userId, accountId, rows)
  let count = 0
  let skipped = 0

  for (const row of rows) {
    const fp = txFingerprint(row)
    if (existing.has(fp)) { skipped++; continue }
    try {
      await db.insert(userId, {
        type: row.type,
        amount: row.amount_paise,
        currency: 'INR',
        date: row.date,
        time: null,
        merchant: null,
        description: row.description,
        upi_ref: row.upi_ref,
        bank: null,
        category: null,
        account_id: accountId,
        to_account_id: null,
        source: 'bank_import',
        raw_ai_response: null,
        confidence: 'medium',
        reviewed: false,
        is_recurring: false,
        recurrence_group: null,
      })
      existing.add(fp)
      count++
    } catch (err: unknown) {
      if (isUniqueViolation(err)) { skipped++ }
      else throw err
    }
  }

  if (count > 0) {
    updateTag('transactions')
    refresh()
  }

  return { count, skipped }
}

function isUniqueViolation(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code: string }).code === '23505'
  }
  return false
}
