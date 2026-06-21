import { getDb } from '../db/database'
import type { TxInput } from './transactionRepository'

export async function createImportSession(filename: string | null): Promise<string> {
  const db = getDb()
  const id = crypto.randomUUID()
  await db.runAsync(
    'INSERT INTO import_sessions (id, filename, status) VALUES (?, ?, ?)',
    [id, filename, 'reviewing'],
  )
  return id
}

export async function completeImportSession(id: string): Promise<void> {
  const db = getDb()
  await db.runAsync("UPDATE import_sessions SET status = 'done' WHERE id = ?", [id])
}

export async function bulkInsertUnreviewed(
  sessionId: string,
  rows: Array<Omit<TxInput, 'reviewed'>>,
): Promise<void> {
  const db = getDb()
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const id = crypto.randomUUID()
      await db.runAsync(
        `INSERT INTO transactions
          (id, type, amount, date, time, merchant, description, category,
           account_id, to_account_id, is_recurring, reviewed, source, upi_ref)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          id,
          row.type,
          row.amount,
          row.date,
          row.time ?? null,
          row.merchant ?? null,
          row.description ?? '',
          row.category ?? null,
          row.account_id ?? null,
          row.to_account_id ?? null,
          row.is_recurring ? 1 : 0,
          row.source ?? 'bank_import',
          row.upi_ref ?? null,
        ],
      )
    }
  })
}
