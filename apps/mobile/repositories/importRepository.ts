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

export type ImportHistoryItem = ImportSession & {
  imported_count: number
  duplicate_count: number
  review_status: string | null
}

export type ImportDetails = {
  session: ImportSession
  transactionsImported: number
  duplicateCount: number
  groupCount: number
  newMerchantCount: number
  learnedMappingsUsed: number
  unknownMerchantCount: number
  reviewedCount: number
  totalReviewCount: number
  reviewStatus: string
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

export async function listImportHistory(limit = 20): Promise<ImportHistoryItem[]> {
  const db = getDb()
  return db.getAllAsync<ImportHistoryItem>(
    `SELECT
       i.*,
       COUNT(t.id) AS imported_count,
       SUM(CASE WHEN t.duplicate_status IN ('confirmed_duplicate', 'possible_duplicate') THEN 1 ELSE 0 END) AS duplicate_count,
       COALESCE(MAX(rs.review_status), CASE WHEN COUNT(t.id) = 0 THEN NULL ELSE 'completed' END) AS review_status
     FROM import_sessions i
     LEFT JOIN transactions t ON t.import_session_id = i.id
     LEFT JOIN review_sessions rs ON rs.import_session_id = i.id
     GROUP BY i.id
     ORDER BY COALESCE(i.updated_at, i.created_at) DESC
     LIMIT ?`,
    [limit],
  )
}

export async function getImportDetails(importSessionId: string): Promise<ImportDetails | null> {
  const db = getDb()
  const session = await db.getFirstAsync<ImportSession>(
    'SELECT * FROM import_sessions WHERE id = ?',
    [importSessionId],
  )
  if (!session) return null

  const counts = await db.getFirstAsync<{
    transactions_imported: number
    duplicate_count: number
    group_count: number
    new_merchant_count: number
    learned_mappings_used: number
    unknown_merchant_count: number
    reviewed_count: number
  }>(
    `SELECT
       COUNT(*) AS transactions_imported,
       SUM(CASE WHEN duplicate_status IN ('confirmed_duplicate', 'possible_duplicate') THEN 1 ELSE 0 END) AS duplicate_count,
       COUNT(DISTINCT COALESCE(normalized_lookup_key, parsed_display_name, merchant, raw_description, description, id)) AS group_count,
       COUNT(DISTINCT CASE WHEN category_source != 'learned' OR category_source IS NULL THEN normalized_lookup_key END) AS new_merchant_count,
       COUNT(DISTINCT CASE WHEN category_source = 'learned' THEN normalized_lookup_key END) AS learned_mappings_used,
       COUNT(DISTINCT CASE WHEN category_source IS NULL OR category_source = 'unknown' THEN normalized_lookup_key END) AS unknown_merchant_count,
       SUM(CASE WHEN reviewed = 1 THEN 1 ELSE 0 END) AS reviewed_count
     FROM transactions
     WHERE import_session_id = ?`,
    [importSessionId],
  )
  const review = await db.getFirstAsync<{ review_status: string; review_progress: number; total_count: number }>(
    'SELECT review_status, review_progress, total_count FROM review_sessions WHERE import_session_id = ? ORDER BY updated_at DESC LIMIT 1',
    [importSessionId],
  )

  const totalReviewCount = review?.total_count ?? counts?.transactions_imported ?? 0
  const reviewedCount = review?.review_progress ?? counts?.reviewed_count ?? 0

  return {
    session,
    transactionsImported: counts?.transactions_imported ?? 0,
    duplicateCount: counts?.duplicate_count ?? 0,
    groupCount: counts?.group_count ?? 0,
    newMerchantCount: counts?.new_merchant_count ?? 0,
    learnedMappingsUsed: counts?.learned_mappings_used ?? 0,
    unknownMerchantCount: counts?.unknown_merchant_count ?? 0,
    reviewedCount,
    totalReviewCount,
    reviewStatus: review?.review_status ?? (session.status === 'done' ? 'completed' : session.status),
  }
}

export async function countImportSessions(): Promise<number> {
  const db = getDb()
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM import_sessions')
  return row?.count ?? 0
}

export async function countReviewSessions(): Promise<number> {
  const db = getDb()
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM review_sessions')
  return row?.count ?? 0
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
