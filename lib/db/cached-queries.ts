import 'server-only'
import { cacheTag } from 'next/cache'
import { db, accountsDb, categoriesDb, settingsDb } from './index'
import type { Transaction } from '../types/transaction'
import type { Account } from '../types/account'
import type { UserSettings } from './types'

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

export async function getCachedCategories(): Promise<string[]> {
  'use cache'
  cacheTag('categories')
  return categoriesDb.getAll()
}

export async function getCachedCustomCategories(): Promise<string[]> {
  'use cache'
  cacheTag('categories')
  return categoriesDb.getCustom()
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
