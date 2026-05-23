'use server'

import { updateTag } from 'next/cache'
import { getSupabaseClient } from '@/lib/db/supabase-client'

export async function addCategory(name: string): Promise<void> {
  await getSupabaseClient()
    .from('categories')
    .upsert({ name, is_predefined: false }, { onConflict: 'name', ignoreDuplicates: true })
  updateTag('categories')
}

export async function removeCategory(name: string): Promise<void> {
  await getSupabaseClient()
    .from('categories')
    .delete()
    .eq('name', name)
    .eq('is_predefined', false)
  updateTag('categories')
}

export async function removeCategoryAndUnlinkTransactions(name: string): Promise<void> {
  const supabase = getSupabaseClient()
  await supabase.from('transactions').update({ category: null }).eq('category', name)
  await supabase.from('categories').delete().eq('name', name).eq('is_predefined', false)
  updateTag('categories')
  updateTag('transactions')
}

export async function clearAllTransactions(): Promise<void> {
  await getSupabaseClient().from('transactions').delete().neq('id', '')
  updateTag('transactions')
}
