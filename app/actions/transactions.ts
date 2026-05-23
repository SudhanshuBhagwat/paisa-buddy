'use server'

import { updateTag } from 'next/cache'
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
  }
  await db.insert(tx)
  updateTag('transactions')
}

export async function deleteTransaction(id: string): Promise<void> {
  await db.delete(id)
  updateTag('transactions')
}

export async function confirmTransaction(id: string): Promise<void> {
  await db.update(id, { reviewed: true })
  updateTag('transactions')
}

export async function rejectTransaction(id: string): Promise<void> {
  await db.delete(id)
  updateTag('transactions')
}

export async function updateAndConfirmTransaction(
  id: string,
  updates: Partial<Omit<Transaction, 'id' | 'created_at'>>,
): Promise<void> {
  if (updates.category) {
    await getSupabaseClient()
      .from('categories')
      .upsert({ name: updates.category, is_predefined: false }, { onConflict: 'name', ignoreDuplicates: true })
  }
  await db.update(id, { ...updates, reviewed: true })
  updateTag('transactions')
}
