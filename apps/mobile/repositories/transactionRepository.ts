import { generateId } from '../lib/id'
import { getDb } from '../db/database'
import { addMonths } from '@paisa-buddy/shared/logic/date'
import type { CategorySource, DuplicateStatus, Transaction, TransactionType } from '@paisa-buddy/shared/types/transaction'

type TxRow = {
  id: string
  type: string
  amount: number
  date: string
  time: string | null
  merchant: string | null
  description: string | null
  category: string | null
  account_id: string | null
  to_account_id: string | null
  is_recurring: number
  reviewed: number
  source: string
  upi_ref: string | null
  bank: string | null
  raw_description: string | null
  parsed_display_name: string | null
  user_display_name: string | null
  normalized_lookup_key: string | null
  parser_version: string | null
  category_source: string | null
  dedupe_key: string | null
  import_session_id: string | null
  duplicate_status: string | null
  duplicate_of_transaction_id: string | null
  created_at: string
}

function rowToTransaction(row: TxRow): Transaction {
  return {
    id: row.id,
    user_id: 'local',
    type: row.type as TransactionType,
    amount: row.amount,
    currency: 'INR',
    date: row.date,
    time: row.time,
    merchant: row.merchant,
    description: row.description ?? '',
    category: row.category,
    account_id: row.account_id,
    to_account_id: row.to_account_id,
    is_recurring: row.is_recurring === 1,
    reviewed: row.reviewed === 1,
    source: row.source as Transaction['source'],
    upi_ref: row.upi_ref,
    bank: row.bank,
    raw_description: row.raw_description,
    parsed_display_name: row.parsed_display_name,
    user_display_name: row.user_display_name,
    normalized_lookup_key: row.normalized_lookup_key,
    parser_version: row.parser_version,
    category_source: row.category_source as CategorySource | null,
    dedupe_key: row.dedupe_key,
    import_session_id: row.import_session_id,
    duplicate_status: row.duplicate_status as DuplicateStatus | null,
    duplicate_of_transaction_id: row.duplicate_of_transaction_id,
    raw_ai_response: null,
    confidence: null,
    recurrence_group: null,
    investment_id: null,
    created_at: row.created_at,
  }
}

function monthRange(month: string): { start: string; end: string } {
  return { start: `${month}-01`, end: `${addMonths(month, 1)}-01` }
}

export type TxInput = {
  type: TransactionType
  amount: number
  date: string
  time?: string | null
  merchant?: string | null
  description?: string
  category?: string | null
  account_id?: string | null
  to_account_id?: string | null
  is_recurring?: boolean
  reviewed?: boolean
  source?: Transaction['source']
  upi_ref?: string | null
  bank?: string | null
  raw_description?: string | null
  parsed_display_name?: string | null
  user_display_name?: string | null
  normalized_lookup_key?: string | null
  parser_version?: string | null
  category_source?: CategorySource | null
  dedupe_key?: string | null
  import_session_id?: string | null
  duplicate_status?: DuplicateStatus | null
  duplicate_of_transaction_id?: string | null
}

export type TxPatch = Partial<TxInput>

export async function createTransaction(input: TxInput): Promise<Transaction> {
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()
  await db.runAsync(
    `INSERT INTO transactions
      (id, type, amount, date, time, merchant, description, category,
       account_id, to_account_id, is_recurring, reviewed, source, upi_ref, bank,
       raw_description, parsed_display_name, user_display_name, normalized_lookup_key,
       parser_version, category_source, dedupe_key, import_session_id,
       duplicate_status, duplicate_of_transaction_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.type,
      input.amount,
      input.date,
      input.time ?? null,
      input.merchant ?? null,
      input.description ?? '',
      input.category ?? null,
      input.account_id ?? null,
      input.to_account_id ?? null,
      input.is_recurring ? 1 : 0,
      input.reviewed !== false ? 1 : 0,
      input.source ?? 'manual',
      input.upi_ref ?? null,
      input.bank ?? null,
      input.raw_description ?? null,
      input.parsed_display_name ?? null,
      input.user_display_name ?? null,
      input.normalized_lookup_key ?? null,
      input.parser_version ?? null,
      input.category_source ?? null,
      input.dedupe_key ?? null,
      input.import_session_id ?? null,
      input.duplicate_status ?? 'none',
      input.duplicate_of_transaction_id ?? null,
      now,
    ],
  )
  return rowToTransaction({
    id, type: input.type, amount: input.amount, date: input.date,
    time: input.time ?? null, merchant: input.merchant ?? null,
    description: input.description ?? '', category: input.category ?? null,
    account_id: input.account_id ?? null, to_account_id: input.to_account_id ?? null,
    is_recurring: input.is_recurring ? 1 : 0,
    reviewed: input.reviewed !== false ? 1 : 0,
    source: input.source ?? 'manual', upi_ref: input.upi_ref ?? null,
    bank: input.bank ?? null,
    raw_description: input.raw_description ?? null,
    parsed_display_name: input.parsed_display_name ?? null,
    user_display_name: input.user_display_name ?? null,
    normalized_lookup_key: input.normalized_lookup_key ?? null,
    parser_version: input.parser_version ?? null,
    category_source: input.category_source ?? null,
    dedupe_key: input.dedupe_key ?? null,
    import_session_id: input.import_session_id ?? null,
    duplicate_status: input.duplicate_status ?? 'none',
    duplicate_of_transaction_id: input.duplicate_of_transaction_id ?? null,
    created_at: now,
  })
}

const UPDATABLE_COLS = [
  'type', 'amount', 'date', 'time', 'merchant', 'description',
  'category', 'account_id', 'to_account_id', 'source', 'upi_ref', 'bank',
  'raw_description', 'parsed_display_name', 'user_display_name', 'normalized_lookup_key',
  'parser_version', 'category_source', 'dedupe_key', 'import_session_id',
  'duplicate_status', 'duplicate_of_transaction_id',
] as const

export async function updateTransaction(id: string, patch: TxPatch & { reviewed?: boolean }): Promise<Transaction> {
  const db = getDb()
  const sets: string[] = []
  const params: (string | number | null)[] = []
  const p = patch as Record<string, unknown>

  for (const col of UPDATABLE_COLS) {
    if (col in p) {
      sets.push(`${col} = ?`)
      params.push((p[col] ?? null) as string | number | null)
    }
  }
  if ('is_recurring' in p) { sets.push('is_recurring = ?'); params.push(p.is_recurring ? 1 : 0) }
  if ('reviewed' in p)     { sets.push('reviewed = ?');     params.push(p.reviewed ? 1 : 0) }

  if (sets.length > 0) {
    params.push(id)
    await db.runAsync(`UPDATE transactions SET ${sets.join(', ')} WHERE id = ?`, params)
  }

  const row = await db.getFirstAsync<TxRow>('SELECT * FROM transactions WHERE id = ?', [id])
  if (!row) throw new Error(`Transaction not found: ${id}`)
  return rowToTransaction(row)
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = getDb()
  await db.runAsync('DELETE FROM transactions WHERE id = ?', [id])
}

export async function getAll(): Promise<Transaction[]> {
  const db = getDb()
  const rows = await db.getAllAsync<TxRow>('SELECT * FROM transactions ORDER BY date DESC, time DESC, created_at DESC')
  return rows.map(rowToTransaction)
}

export async function getTransactionById(id: string): Promise<Transaction | null> {
  const db = getDb()
  const row = await db.getFirstAsync<TxRow>('SELECT * FROM transactions WHERE id = ?', [id])
  return row ? rowToTransaction(row) : null
}

export async function getByMonth(month: string): Promise<Transaction[]> {
  const db = getDb()
  const { start, end } = monthRange(month)
  const rows = await db.getAllAsync<TxRow>(
    'SELECT * FROM transactions WHERE date >= ? AND date < ? ORDER BY date DESC, time DESC, created_at DESC',
    [start, end],
  )
  return rows.map(rowToTransaction)
}

export async function getByMonths(months: string[]): Promise<Transaction[]> {
  const uniqueMonths = [...new Set(months)].filter(Boolean)
  if (uniqueMonths.length === 0) return []

  const db = getDb()
  const ranges = uniqueMonths.map(monthRange)
  const clauses = ranges.map(() => '(date >= ? AND date < ?)').join(' OR ')
  const rows = await db.getAllAsync<TxRow>(
    `SELECT * FROM transactions WHERE ${clauses} ORDER BY date DESC, time DESC, created_at DESC`,
    ranges.flatMap(({ start, end }) => [start, end]),
  )
  return rows.map(rowToTransaction)
}

export async function getUnreviewed(): Promise<Transaction[]> {
  const db = getDb()
  const rows = await db.getAllAsync<TxRow>(
    'SELECT * FROM transactions WHERE reviewed = 0 ORDER BY date DESC, created_at DESC',
  )
  return rows.map(rowToTransaction)
}

export async function getRecentTransactions(limit: number = 5): Promise<Transaction[]> {
  const db = getDb()
  const rows = await db.getAllAsync<TxRow>(
    `SELECT * FROM transactions
     WHERE reviewed = 1
     ORDER BY date DESC, time DESC, created_at DESC
     LIMIT ?`,
    [limit],
  )
  return rows.map(rowToTransaction)
}

export type MonthlyTransactionTotals = {
  income: number
  expense: number
  transfer: number
  balance: number
}

export async function getMonthlyTransactionTotals(month: string): Promise<MonthlyTransactionTotals> {
  const db = getDb()
  const { start, end } = monthRange(month)
  const row = await db.getFirstAsync<{
    income: number | null
    expense: number | null
    transfer: number | null
  }>(
    `SELECT
       SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) AS income,
       SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) AS expense,
       SUM(CASE WHEN type = 'transfer' THEN amount ELSE 0 END) AS transfer
     FROM transactions
     WHERE reviewed = 1
       AND date >= ?
       AND date < ?`,
    [start, end],
  )
  const income = row?.income ?? 0
  const expense = row?.expense ?? 0
  const transfer = row?.transfer ?? 0
  return { income, expense, transfer, balance: income - expense }
}

export async function getPendingReviewCount(): Promise<number> {
  const db = getDb()
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM transactions WHERE reviewed = 0',
  )
  return row?.count ?? 0
}

export type MonthlySpend = { month: string; spent: number }

export async function getMonthlySpends(limitMonths: number = 12): Promise<MonthlySpend[]> {
  const db = getDb()
  return db.getAllAsync<MonthlySpend>(
    `SELECT strftime('%Y-%m', date) AS month, SUM(amount) AS spent
     FROM transactions
     WHERE type = 'debit'
     GROUP BY month
     ORDER BY month DESC
     LIMIT ?`,
    [limitMonths],
  )
}

export async function getCategorySpendsByMonth(month: string): Promise<Array<{ category: string; total: number }>> {
  const db = getDb()
  const { start, end } = monthRange(month)
  return db.getAllAsync(
    `SELECT category, SUM(amount) AS total
     FROM transactions
     WHERE type = 'debit'
       AND date >= ?
       AND date < ?
       AND category IS NOT NULL
     GROUP BY category
     ORDER BY total DESC`,
    [start, end],
  )
}

export async function getTotalCount(): Promise<number> {
  const db = getDb()
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM transactions')
  return row?.count ?? 0
}
