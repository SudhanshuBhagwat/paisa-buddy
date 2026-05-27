'use server'

import { updateTag, refresh } from 'next/cache'
import { db, categoriesDb } from '@/lib/db'
import { getRequiredUserId } from '@/lib/auth/require-user'
import type { Transaction } from '@/lib/types/transaction'

export async function insertTransaction(
  tx: Omit<Transaction, 'id' | 'created_at' | 'user_id'>,
): Promise<void> {
  const userId = await getRequiredUserId()
  if (tx.category) {
    await categoriesDb.upsertCustom(tx.category)
    updateTag('categories')
  }
  await db.insert(userId, tx)
  await db.detectRecurring(userId)
  updateTag('transactions')
  refresh()
}

export async function deleteTransaction(id: string): Promise<void> {
  const userId = await getRequiredUserId()
  await db.delete(userId, id)
  await db.detectRecurring(userId)
  updateTag('transactions')
  refresh()
}

export async function confirmTransaction(id: string): Promise<void> {
  const userId = await getRequiredUserId()
  await db.update(userId, id, { reviewed: true })
  await db.detectRecurring(userId)
  updateTag('transactions')
  refresh()
}

export async function rejectTransaction(id: string): Promise<void> {
  const userId = await getRequiredUserId()
  await db.delete(userId, id)
  updateTag('transactions')
  refresh()
}

export async function updateAndConfirmTransaction(
  id: string,
  updates: Partial<Omit<Transaction, 'id' | 'created_at' | 'user_id'>>,
): Promise<void> {
  const userId = await getRequiredUserId()
  if (updates.category) {
    await categoriesDb.upsertCustom(updates.category)
    updateTag('categories')
  }
  await db.update(userId, id, { ...updates, reviewed: true })
  await db.detectRecurring(userId)
  updateTag('transactions')
  refresh()
}

export async function updateTransaction(
  id: string,
  updates: Partial<Omit<Transaction, 'id' | 'created_at' | 'user_id'>>,
): Promise<void> {
  const userId = await getRequiredUserId()
  if (updates.category) {
    await categoriesDb.upsertCustom(updates.category)
    updateTag('categories')
  }
  await db.update(userId, id, updates)
  updateTag('transactions')
  refresh()
}
