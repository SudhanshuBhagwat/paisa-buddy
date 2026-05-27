'use server'

import { updateTag, refresh } from 'next/cache'
import { categoriesDb, db } from '@/lib/db'
import { getRequiredUserId } from '@/lib/auth/require-user'

export async function addCategory(name: string): Promise<void> {
  await categoriesDb.upsertCustom(name)
  updateTag('categories')
  refresh()
}

export async function removeCategory(name: string): Promise<void> {
  await categoriesDb.deleteCustom(name)
  updateTag('categories')
  refresh()
}

export async function removeCategoryAndUnlinkTransactions(name: string): Promise<void> {
  const userId = await getRequiredUserId()
  await categoriesDb.deleteCustomAndUnlinkTransactions(userId, name)
  updateTag('categories')
  updateTag('transactions')
  refresh()
}

export async function clearAllTransactions(): Promise<void> {
  const userId = await getRequiredUserId()
  await db.deleteAll(userId)
  updateTag('transactions')
  refresh()
}
