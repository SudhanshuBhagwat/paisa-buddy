import { generateId } from '../lib/id'
import { getDb } from '../db/database'
import { addMonths } from '@paisa-buddy/shared/logic/date'
import type { Budget, BudgetWithSpent } from '@paisa-buddy/shared/types/budget'

type PlanRow = {
  id: string
  category: string
  amount: number
  spent: number
  created_at: string
}

function rowToBudgetWithSpent(row: PlanRow): BudgetWithSpent {
  return {
    id: row.id,
    user_id: 'local',
    category: row.category,
    amount: row.amount,
    period: 'monthly',
    spent: row.spent,
    created_at: row.created_at,
  }
}

export async function listPlans(month: string): Promise<BudgetWithSpent[]> {
  const db = getDb()
  const start = `${month}-01`
  const end = `${addMonths(month, 1)}-01`
  const rows = await db.getAllAsync<PlanRow>(
    `SELECT p.*,
       COALESCE((
         SELECT SUM(t.amount)
         FROM transactions t
         WHERE t.category = p.category
           AND t.type = 'debit'
           AND t.date >= ?
           AND t.date < ?
       ), 0) AS spent
     FROM plans p
     ORDER BY p.created_at ASC`,
    [start, end],
  )
  return rows.map(rowToBudgetWithSpent)
}

export async function upsertPlan(category: string, amount: number): Promise<Budget> {
  const db = getDb()
  const now = new Date().toISOString()
  const id = generateId()
  await db.runAsync(
    `INSERT INTO plans (id, category, amount, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(category) DO UPDATE SET amount = excluded.amount`,
    [id, category, amount, now],
  )
  const row = await db.getFirstAsync<{ id: string; category: string; amount: number; created_at: string }>(
    'SELECT * FROM plans WHERE category = ?',
    [category],
  )
  return {
    id: row?.id ?? id,
    user_id: 'local',
    category,
    amount,
    period: 'monthly',
    created_at: row?.created_at ?? now,
  }
}

export async function deletePlan(id: string): Promise<void> {
  const db = getDb()
  await db.runAsync('DELETE FROM plans WHERE id = ?', [id])
}
