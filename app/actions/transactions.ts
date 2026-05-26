'use server'

import { updateTag, refresh } from 'next/cache'
import db from '@/lib/db'
import { getSupabaseClient } from '@/lib/db/supabase-client'
import type { Transaction } from '@/lib/types/transaction'

export async function insertTransaction(
  tx: Omit<Transaction, 'id' | 'created_at'>,
): Promise<void> {
  if (tx.category) {
    await getSupabaseClient()
      .from('categories')
      .upsert({ name: tx.category, is_predefined: false }, { onConflict: 'name', ignoreDuplicates: true })
    updateTag('categories')
  }
  await db.insert(tx)
  await db.detectRecurring()
  updateTag('transactions')
  refresh()
}

export async function deleteTransaction(id: string): Promise<void> {
  await db.delete(id)
  updateTag('transactions')
  refresh()
}

export async function confirmTransaction(id: string): Promise<void> {
  await db.update(id, { reviewed: true })
  await db.detectRecurring()
  updateTag('transactions')
  refresh()
}

export async function rejectTransaction(id: string): Promise<void> {
  await db.delete(id)
  updateTag('transactions')
  refresh()
}

export async function updateAndConfirmTransaction(
  id: string,
  updates: Partial<Omit<Transaction, 'id' | 'created_at'>>,
): Promise<void> {
  if (updates.category) {
    await getSupabaseClient()
      .from('categories')
      .upsert({ name: updates.category, is_predefined: false }, { onConflict: 'name', ignoreDuplicates: true })
    updateTag('categories')
  }
  await db.update(id, { ...updates, reviewed: true })
  await db.detectRecurring()
  updateTag('transactions')
  refresh()
}

export async function updateTransaction(
  id: string,
  updates: Partial<Omit<Transaction, 'id' | 'created_at'>>,
): Promise<void> {
  if (updates.category) {
    await getSupabaseClient()
      .from('categories')
      .upsert({ name: updates.category, is_predefined: false }, { onConflict: 'name', ignoreDuplicates: true })
    updateTag('categories')
  }
  await db.update(id, updates)
  updateTag('transactions')
  refresh()
}
