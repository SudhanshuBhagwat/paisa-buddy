import 'server-only'
import type { InvestmentRepository } from '../types'
import type { Investment, InvestmentWithTotal } from '@paisa-buddy/shared/types/investment'
import { withUserContext } from './client'

function rowToInvestment(row: Record<string, unknown>): Investment {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    created_at: row.created_at as string,
  }
}

export class PostgresInvestmentRepository implements InvestmentRepository {
  async getAll(userId: string): Promise<InvestmentWithTotal[]> {
    return withUserContext(userId, async (db) => {
      const rows = await db`
        SELECT i.*,
          COALESCE(
            SUM(CASE WHEN t.type = 'debit'  THEN t.amount ELSE 0 END) -
            SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END),
            0
          )::bigint AS total_invested
        FROM investments i
        LEFT JOIN transactions t
          ON t.investment_id = i.id AND t.reviewed = true AND t.user_id = ${userId}
        WHERE i.user_id = ${userId}
        GROUP BY i.id
        ORDER BY i.name ASC
      `
      return rows.map((row) => ({
        ...rowToInvestment(row),
        total_invested: Number(row.total_invested),
      }))
    })
  }

  async insert(userId: string, name: string): Promise<Investment> {
    return withUserContext(userId, async (db) => {
      const [row] = await db`
        INSERT INTO investments ${db({ user_id: userId, name })}
        RETURNING *
      `
      return rowToInvestment(row)
    })
  }

  async update(userId: string, id: string, name: string): Promise<Investment> {
    return withUserContext(userId, async (db) => {
      const [row] = await db`
        UPDATE investments SET name = ${name}
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING *
      `
      return rowToInvestment(row)
    })
  }

  async delete(userId: string, id: string): Promise<void> {
    return withUserContext(userId, async (db) => {
      await db`DELETE FROM investments WHERE id = ${id} AND user_id = ${userId}`
    })
  }
}
