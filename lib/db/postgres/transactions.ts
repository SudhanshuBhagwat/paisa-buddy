import 'server-only'
import type postgres from 'postgres'
import type { TransactionRepository } from '../types'
import type { Transaction, TransactionFilters } from '../../types/transaction'
import { withUserContext } from './client'
import { detectRecurringGroups } from '../../recurring'

// postgres.js returns DATE as "YYYY-MM-DD" string, TIME as "HH:MM:SS" string,
// TIMESTAMPTZ as a Date object, BIGINT as a string (to avoid precision loss).
function rowToTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    account_id: (row.account_id as string | null) ?? null,
    to_account_id: (row.to_account_id as string | null) ?? null,
    type: row.type as Transaction['type'],
    amount: Number(row.amount),           // BIGINT → string → number (safe: paise << MAX_SAFE_INTEGER)
    currency: row.currency as string,
    date: row.date as string,             // DATE → "YYYY-MM-DD"
    time: row.time                        // TIME → "HH:MM:SS", truncate to "HH:MM"
      ? (row.time as string).slice(0, 5)
      : null,
    merchant: (row.merchant as string | null) ?? null,
    description: (row.description as string | null) ?? '',
    upi_ref: (row.upi_ref as string | null) ?? null,
    bank: (row.bank as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    source: row.source as Transaction['source'],
    raw_ai_response: (row.raw_ai_response as string | null) ?? null,
    confidence: (row.confidence as Transaction['confidence'] | null) ?? null,
    reviewed: row.reviewed as boolean,
    is_recurring: row.is_recurring as boolean,
    recurrence_group: (row.recurrence_group as string | null) ?? null,
    created_at: row.created_at as string,
  }
}

export class PostgresTransactionRepository implements TransactionRepository {
  async insert(
    userId: string,
    data: Omit<Transaction, 'id' | 'created_at' | 'user_id'>,
  ): Promise<Transaction> {
    return withUserContext(userId, async (db) => {
      const [row] = await db`
        INSERT INTO transactions ${db({ user_id: userId, ...data })}
        RETURNING *
      `
      return rowToTransaction(row)
    })
  }

  async getPending(userId: string): Promise<Transaction[]> {
    return withUserContext(userId, async (db) => {
      const rows = await db`
        SELECT * FROM transactions
        WHERE user_id = ${userId} AND reviewed = false
        ORDER BY created_at DESC
      `
      return rows.map(rowToTransaction)
    })
  }

  async getAll(userId: string, filters?: TransactionFilters): Promise<Transaction[]> {
    return withUserContext(userId, async (db) => {
      const rows = await db`
        SELECT * FROM transactions
        WHERE user_id = ${userId}
          ${filters?.reviewed !== undefined ? db`AND reviewed = ${filters.reviewed}` : db``}
          ${filters?.type     ? db`AND type = ${filters.type}` : db``}
          ${filters?.category ? db`AND category = ${filters.category}` : db``}
          ${filters?.dateFrom ? db`AND date >= ${filters.dateFrom}` : db``}
          ${filters?.dateTo   ? db`AND date <= ${filters.dateTo}` : db``}
          ${filters?.search   ? db`AND (merchant ILIKE ${'%' + filters.search + '%'} OR description ILIKE ${'%' + filters.search + '%'})` : db``}
        ORDER BY date DESC
      `
      return rows.map(rowToTransaction)
    })
  }

  async update(
    userId: string,
    id: string,
    data: Partial<Omit<Transaction, 'id' | 'created_at' | 'user_id'>>,
  ): Promise<Transaction> {
    return withUserContext(userId, async (db) => {
      const [row] = await db`
        UPDATE transactions
        SET ${db(data)}
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING *
      `
      return rowToTransaction(row)
    })
  }

  async delete(userId: string, id: string): Promise<void> {
    return withUserContext(userId, async (db) => {
      await db`DELETE FROM transactions WHERE id = ${id} AND user_id = ${userId}`
    })
  }

  async deleteAll(userId: string): Promise<void> {
    return withUserContext(userId, async (db) => {
      await db`DELETE FROM transactions WHERE user_id = ${userId}`
    })
  }

  async detectRecurring(userId: string): Promise<void> {
    return withUserContext(userId, async (db) => {
      const rows = await db`
        SELECT * FROM transactions
        WHERE user_id = ${userId} AND reviewed = true AND merchant IS NOT NULL
      `
      const txs = rows.map(rowToTransaction)
      const updates = detectRecurringGroups(txs)
      const validIds = new Set(updates.map((u) => u.id))

      if (updates.length > 0) {
        const byGroup = new Map<string, string[]>()
        for (const u of updates) {
          if (!byGroup.has(u.recurrence_group)) byGroup.set(u.recurrence_group, [])
          byGroup.get(u.recurrence_group)!.push(u.id)
        }
        await Promise.all(
          Array.from(byGroup.entries()).map(([groupId, ids]) =>
            db`UPDATE transactions
               SET is_recurring = true, recurrence_group = ${groupId}
               WHERE id = ANY(${ids as unknown as postgres.Parameter<string[]>}) AND user_id = ${userId}`,
          ),
        )
      }

      const toUnflag = txs.filter(
        (tx) => tx.is_recurring && tx.recurrence_group !== null && !validIds.has(tx.id),
      )
      if (toUnflag.length > 0) {
        const ids = toUnflag.map((tx) => tx.id)
        await db`
          UPDATE transactions
          SET is_recurring = false, recurrence_group = NULL
          WHERE id = ANY(${ids as unknown as postgres.Parameter<string[]>}) AND user_id = ${userId}
        `
      }
    })
  }
}
