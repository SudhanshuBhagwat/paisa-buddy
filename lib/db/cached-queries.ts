import 'server-only'
import { cacheTag } from 'next/cache'
import { db, accountsDb, settingsDb } from './index'
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

export async function getCachedUserSettings(userId: string): Promise<UserSettings> {
  'use cache'
  cacheTag('user-settings')
  return settingsDb.get(userId)
}
