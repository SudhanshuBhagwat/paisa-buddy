'use server'

import { updateTag, refresh } from 'next/cache'
import { getRequiredUserId } from '@/lib/auth/require-user'
import { budgetsDb } from '@/lib/db'

export async function upsertBudget(category: string, amount: number): Promise<void> {
  const userId = await getRequiredUserId()
  await budgetsDb.upsert(userId, category, amount)
  updateTag('budgets')
  refresh()
}

export async function deleteBudget(id: string): Promise<void> {
  const userId = await getRequiredUserId()
  await budgetsDb.delete(userId, id)
  updateTag('budgets')
  refresh()
}
