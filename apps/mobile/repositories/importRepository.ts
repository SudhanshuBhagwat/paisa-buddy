import { generateId } from '../lib/id'
import { getDb } from '../db/database'
import type { TxInput } from './transactionRepository'

export type ImportSession = {
  id: string
  filename: string | null
  file_name: string | null
  file_hash: string | null
  transaction_count: number
  statement_start_date: string | null
  statement_end_date: string | null
  status: string
  created_at: string
  updated_at: string | null
}

export type ImportSessionInput = {
  fileName: string | null
  fileHash: string | null
  transactionCount: number
  statementStartDate: string | null
  statementEndDate: string | null
}

export async function createImportSession(input: ImportSessionInput): Promise<string> {
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()
  await db.runAsync(
    `INSERT INTO import_sessions
      (id, filename, file_name, file_hash, transaction_count, statement_start_date, statement_end_date, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.fileName,
      input.fileName,
      input.fileHash,
      input.transactionCount,
      input.statementStartDate,
      input.statementEndDate,
      'reviewing',
      now,
    ],
  )
  return id
}

export async function completeImportSession(id: string): Promise<void> {
  const db = getDb()
  await db.runAsync("UPDATE import_sessions SET status = 'done', updated_at = ? WHERE id = ?", [new Date().toISOString(), id])
}

export async function findImportSessionByHash(fileHash: string): Promise<ImportSession | null> {
  const db = getDb()
  return db.getFirstAsync<ImportSession>(
    'SELECT * FROM import_sessions WHERE file_hash = ? ORDER BY created_at DESC LIMIT 1',
    [fileHash],
  )
}

export async function getLatestImportSession(): Promise<ImportSession | null> {
  const db = getDb()
  return db.getFirstAsync<ImportSession>(
    'SELECT * FROM import_sessions ORDER BY created_at DESC LIMIT 1',
  )
}

export async function getLatestCompletedImportSession(): Promise<ImportSession | null> {
  const db = getDb()
  return db.getFirstAsync<ImportSession>(
    "SELECT * FROM import_sessions WHERE status = 'done' ORDER BY created_at DESC LIMIT 1",
  )
}

export async function countTransactionsForImportSession(importSessionId: string): Promise<number> {
  const db = getDb()
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM transactions WHERE import_session_id = ?',
    [importSessionId],
  )
  return row?.count ?? 0
}

export async function undoLatestCompletedImport(): Promise<number> {
  const latest = await getLatestCompletedImportSession()
  if (!latest) return 0

  const db = getDb()
  const count = await countTransactionsForImportSession(latest.id)
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM transactions WHERE import_session_id = ?', [latest.id])
    await db.runAsync('DELETE FROM review_sessions WHERE import_session_id = ?', [latest.id])
    await db.runAsync("UPDATE import_sessions SET status = 'undone', updated_at = ? WHERE id = ?", [new Date().toISOString(), latest.id])
  })
  return count
}

export async function bulkInsertUnreviewed(
  sessionId: string,
  rows: Array<Omit<TxInput, 'reviewed'>>,
): Promise<void> {
  const db = getDb()
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const id = generateId()
      await db.runAsync(
        `INSERT INTO transactions
          (id, type, amount, date, time, merchant, description, category,
           account_id, to_account_id, is_recurring, reviewed, source, upi_ref,
           bank, raw_description, parsed_display_name, user_display_name,
           normalized_lookup_key, parser_version, category_source, dedupe_key,
           import_session_id, duplicate_status, duplicate_of_transaction_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          row.bank ?? null,
          row.raw_description ?? null,
          row.parsed_display_name ?? null,
          row.user_display_name ?? null,
          row.normalized_lookup_key ?? null,
          row.parser_version ?? null,
          row.category_source ?? null,
          row.dedupe_key ?? null,
          sessionId,
          row.duplicate_status ?? 'none',
          row.duplicate_of_transaction_id ?? null,
        ],
      )
    }
  })
}
