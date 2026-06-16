import 'server-only'
import type { BudgetRepository } from '../types'
import type { Budget, BudgetWithSpent } from '../../types/budget'
import { withUserContext } from './client'

function rowToBudget(row: Record<string, unknown>): Budget {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    category: row.category as string,
    amount: Number(row.amount),
    period: 'monthly',
    created_at: row.created_at as string,
  }
}

export class PostgresBudgetRepository implements BudgetRepository {
  async getAll(userId: string, yearMonth: string): Promise<BudgetWithSpent[]> {
    const [y, m] = yearMonth.split('-')
    const dateFrom = `${y}-${m}-01`
    const dateTo = `${y}-${m}-${new Date(Number(y), Number(m), 0).getDate().toString().padStart(2, '0')}`
    return withUserContext(userId, async (db) => {
      const rows = await db`
        SELECT b.*,
          COALESCE(
            SUM(
              CASE WHEN t.type = 'debit'
                AND t.reviewed = true
                AND t.date >= ${dateFrom}
                AND t.date <= ${dateTo}
              THEN t.amount ELSE 0 END
            ),
            0
          )::bigint AS spent
        FROM budgets b
        LEFT JOIN transactions t
          ON t.category = b.category AND t.user_id = ${userId}
        WHERE b.user_id = ${userId}
        GROUP BY b.id
        ORDER BY b.category ASC
      `
      return rows.map((row) => ({
        ...rowToBudget(row),
        spent: Number(row.spent),
      }))
    })
  }

  async upsert(userId: string, category: string, amount: number): Promise<Budget> {
    return withUserContext(userId, async (db) => {
      const [row] = await db`
        INSERT INTO budgets ${db({ user_id: userId, category, amount })}
        ON CONFLICT (user_id, category) DO UPDATE SET amount = ${amount}
        RETURNING *
      `
      return rowToBudget(row)
    })
  }

  async delete(userId: string, id: string): Promise<void> {
    return withUserContext(userId, async (db) => {
      await db`DELETE FROM budgets WHERE id = ${id} AND user_id = ${userId}`
    })
  }
}
