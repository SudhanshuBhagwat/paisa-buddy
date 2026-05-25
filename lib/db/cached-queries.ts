import 'server-only'
import { cacheTag } from 'next/cache'
import db from './index'
import accountsDb from './accounts'
import type { Transaction } from '../types/transaction'
import type { Account } from '../types/account'

export async function getCachedTransactions(): Promise<Transaction[]> {
  'use cache'
  cacheTag('transactions')
  return db.getAll()
}

export async function getCachedPendingTransactions(): Promise<Transaction[]> {
  'use cache'
  cacheTag('transactions')
  return db.getPending()
}

export async function getCachedAccounts(): Promise<Account[]> {
  'use cache'
  cacheTag('accounts')
  return accountsDb.getAll()
}
