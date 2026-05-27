import 'server-only'
import type { AccountRepository } from '../types'
import type { Account } from '../../types/account'
import { withUserContext } from './client'

function rowToAccount(row: Record<string, unknown>): Account {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    type: row.type as Account['type'],
    bank: (row.bank as string | null) ?? null,
    currency: row.currency as string,
    opening_balance: Number(row.opening_balance),
    created_at: (row.created_at instanceof Date
      ? row.created_at.toISOString()
      : row.created_at) as string,
  }
}

export class PostgresAccountRepository implements AccountRepository {
  async getAll(userId: string): Promise<Account[]> {
    return withUserContext(userId, async (db) => {
      const rows = await db`
        SELECT * FROM accounts
        WHERE user_id = ${userId}
        ORDER BY created_at ASC
      `
      return rows.map(rowToAccount)
    })
  }

  async insert(
    userId: string,
    data: Omit<Account, 'id' | 'created_at' | 'user_id'>,
  ): Promise<Account> {
    return withUserContext(userId, async (db) => {
      const [row] = await db`
        INSERT INTO accounts ${db({ user_id: userId, ...data })}
        RETURNING *
      `
      return rowToAccount(row)
    })
  }

  async update(
    userId: string,
    id: string,
    data: Partial<Omit<Account, 'id' | 'created_at' | 'user_id'>>,
  ): Promise<Account> {
    return withUserContext(userId, async (db) => {
      const [row] = await db`
        UPDATE accounts
        SET ${db(data)}
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING *
      `
      return rowToAccount(row)
    })
  }

  async delete(userId: string, id: string): Promise<void> {
    return withUserContext(userId, async (db) => {
      await db`DELETE FROM accounts WHERE id = ${id} AND user_id = ${userId}`
    })
  }
}
