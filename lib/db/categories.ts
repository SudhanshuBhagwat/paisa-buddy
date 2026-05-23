import 'server-only'
import { cacheTag } from 'next/cache'
import { getSupabaseClient } from './supabase-client'

export async function getAllCategories(): Promise<string[]> {
  'use cache'
  cacheTag('categories')
  const { data } = await getSupabaseClient()
    .from('categories')
    .select('name, is_predefined')
    .order('is_predefined', { ascending: false })
    .order('name')
  return (data ?? []).map((r) => r.name as string)
}

export async function getCustomCategories(): Promise<string[]> {
  'use cache'
  cacheTag('categories')
  const { data } = await getSupabaseClient()
    .from('categories')
    .select('name')
    .eq('is_predefined', false)
    .order('name')
  return (data ?? []).map((r) => r.name as string)
}
