import 'server-only'
import { cacheTag } from 'next/cache'
import { getSupabaseClient } from './supabase-client'

export interface UserSettings {
  upiIds: string[]
  displayName: string | null
  setupCompleted: boolean
}

export async function getUserSettings(): Promise<UserSettings> {
  'use cache'
  cacheTag('user-settings')
  const { data } = await getSupabaseClient()
    .from('user_settings')
    .select('upi_ids, display_name, setup_completed')
    .eq('id', 'default')
    .single()
  return {
    upiIds: (data?.upi_ids as string[]) ?? [],
    displayName: (data?.display_name as string | null) ?? null,
    setupCompleted: (data?.setup_completed as boolean) ?? false,
  }
}

// Kept for the upload route which only needs UPI IDs
export async function getUpiIds(): Promise<string[]> {
  const s = await getUserSettings()
  return s.upiIds
}
