'use server'

import { updateTag, refresh } from 'next/cache'
import { categoriesDb, db } from '@/lib/db'
import { getRequiredUserId } from '@/lib/auth/require-user'
import { generateUniqueColor } from '@/lib/categories'

export async function addCategory(name: string): Promise<void> {
  const userId = await getRequiredUserId()
  const existing = await categoriesDb.getCustomWithColors(userId)
  const color = generateUniqueColor(existing.map((c) => c.color))
  await categoriesDb.upsertCustom(userId, name, color)
  updateTag('categories')
  refresh()
}

export async function removeCategory(name: string): Promise<void> {
  const userId = await getRequiredUserId()
  await categoriesDb.deleteCustom(userId, name)
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
