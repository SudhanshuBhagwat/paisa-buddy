import 'server-only'
import { cacheTag } from 'next/cache'
import db from './index'
import type { Transaction } from '../types/transaction'

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
