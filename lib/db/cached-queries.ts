import 'server-only'
import { cacheTag } from 'next/cache'
import { db, accountsDb, categoriesDb, settingsDb } from './index'
import type { Transaction } from '../types/transaction'
import type { Account } from '../types/account'
import type { UserSettings, CategoryWithColor } from './types'
import { PREDEFINED_CATEGORIES, CATEGORY_COLORS } from '../categories'

export async function getCachedTransactions(userId: string): Promise<Transaction[]> {
  'use cache'
  cacheTag('transactions')
  return db.getAll(userId)
}

export async function getCachedPendingTransactions(userId: string): Promise<Transaction[]> {
  'use cache'
  cacheTag('transactions')
  return db.getPending(userId)
}

export async function getCachedAccounts(userId: string): Promise<Account[]> {
  'use cache'
  cacheTag('accounts')
  return accountsDb.getAll(userId)
}

/** Returns predefined categories (from code) + user's custom categories (from DB), each with color. */
export async function getCachedCategoriesWithColors(userId: string): Promise<CategoryWithColor[]> {
  'use cache'
  cacheTag('categories')
  const predefined: CategoryWithColor[] = PREDEFINED_CATEGORIES.map((name) => ({
    name,
    color: CATEGORY_COLORS[name] ?? '#7E8A82',
  }))
  const custom = await categoriesDb.getCustomWithColors(userId)
  return [...predefined, ...custom]
}

export async function getCachedUserSettings(userId: string): Promise<UserSettings> {
  'use cache'
  cacheTag('user-settings')
  return settingsDb.get(userId)
}

export async function getCachedTransactionsByMonth(
  userId: string,
  yearMonth: string, // "YYYY-MM"
): Promise<Transaction[]> {
  'use cache'
  cacheTag('transactions')
  const [y, m] = yearMonth.split('-')
  const dateFrom = `${y}-${m}-01`
  const dateTo = `${y}-${m}-${new Date(Number(y), Number(m), 0).getDate().toString().padStart(2, '0')}`
  return db.getAll(userId, { dateFrom, dateTo })
}
