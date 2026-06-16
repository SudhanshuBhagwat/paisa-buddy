'use server'

import { updateTag, refresh } from 'next/cache'
import { getRequiredUserId } from '@/lib/auth/require-user'
import { investmentsDb } from '@/lib/db/index'
import type { Investment } from '@paisa-buddy/shared/types/investment'

export async function createInvestment(name: string): Promise<Investment> {
  const userId = await getRequiredUserId()
  const investment = await investmentsDb.insert(userId, name.trim())
  updateTag('investments')
  refresh()
  return investment
}

export async function updateInvestment(id: string, name: string): Promise<Investment> {
  const userId = await getRequiredUserId()
  const investment = await investmentsDb.update(userId, id, name.trim())
  updateTag('investments')
  refresh()
  return investment
}

export async function deleteInvestment(id: string): Promise<void> {
  const userId = await getRequiredUserId()
  await investmentsDb.delete(userId, id)
  updateTag('investments')
  refresh()
}
