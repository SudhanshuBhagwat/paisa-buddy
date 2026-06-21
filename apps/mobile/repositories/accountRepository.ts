import { generateId } from '../lib/id'
import { getDb } from '../db/database'
import type { Account, AccountType } from '@paisa-buddy/shared/types/account'

type AccountRow = {
  id: string
  name: string
  type: string
  bank: string | null
  opening_balance: number
  current_balance: number
  created_at: string
}

function rowToAccount(row: AccountRow): Account {
  return {
    id: row.id,
    user_id: 'local',
    name: row.name,
    type: row.type as AccountType,
    bank: row.bank,
    currency: 'INR',
    opening_balance: row.opening_balance,
    current_balance: row.current_balance,
    created_at: row.created_at,
  }
}

// Computes current_balance from transactions in a correlated subquery.
// Transfer out: account_id matches, type = 'transfer' → subtract
// Transfer in:  to_account_id matches, type = 'transfer' → add
const WITH_BALANCE = `
  SELECT a.*,
    a.opening_balance + COALESCE((
      SELECT SUM(
        CASE
          WHEN type = 'credit'   AND account_id    = a.id THEN  amount
          WHEN type = 'debit'    AND account_id    = a.id THEN -amount
          WHEN type = 'transfer' AND account_id    = a.id THEN -amount
          WHEN type = 'transfer' AND to_account_id = a.id THEN  amount
          ELSE 0
        END
      )
      FROM transactions
      WHERE (account_id = a.id OR to_account_id = a.id) AND reviewed = 1
    ), 0) AS current_balance
  FROM accounts a
`

export async function listAccounts(): Promise<Account[]> {
  const db = getDb()
  const rows = await db.getAllAsync<AccountRow>(`${WITH_BALANCE} ORDER BY created_at ASC`)
  return rows.map(rowToAccount)
}

export async function getAccountById(id: string): Promise<Account | null> {
  const db = getDb()
  const row = await db.getFirstAsync<AccountRow>(`${WITH_BALANCE} WHERE a.id = ?`, [id])
  return row ? rowToAccount(row) : null
}

export async function createAccount(
  name: string,
  type: AccountType = 'savings',
  bank?: string | null,
  opening_balance: number = 0,
): Promise<Account> {
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()
  await db.runAsync(
    'INSERT INTO accounts (id, name, type, bank, opening_balance, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, type, bank ?? null, opening_balance, now],
  )
  return {
    id,
    user_id: 'local',
    name,
    type,
    bank: bank ?? null,
    currency: 'INR',
    opening_balance,
    current_balance: opening_balance,
    created_at: now,
  }
}

export type AccountInput = {
  name?: string
  type?: AccountType
  bank?: string | null
  opening_balance?: number
}

export async function updateAccount(id: string, data: AccountInput): Promise<Account> {
  const db = getDb()
  const sets: string[] = []
  const params: (string | number | null)[] = []

  if (data.name !== undefined)            { sets.push('name = ?');            params.push(data.name) }
  if (data.type !== undefined)            { sets.push('type = ?');            params.push(data.type) }
  if ('bank' in data)                     { sets.push('bank = ?');            params.push(data.bank ?? null) }
  if (data.opening_balance !== undefined) { sets.push('opening_balance = ?'); params.push(data.opening_balance) }

  if (sets.length > 0) {
    params.push(id)
    await db.runAsync(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`, params)
  }

  const row = await db.getFirstAsync<AccountRow>(`${WITH_BALANCE} WHERE a.id = ?`, [id])
  if (!row) throw new Error(`Account not found: ${id}`)
  return rowToAccount(row)
}

export async function deleteAccount(id: string): Promise<void> {
  const db = getDb()
  await db.runAsync('DELETE FROM accounts WHERE id = ?', [id])
}
