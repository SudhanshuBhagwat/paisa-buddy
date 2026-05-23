import 'server-only'
import { cacheTag } from 'next/cache'
import { getSupabaseClient } from './supabase-client'

export interface UserSettings {
  upiIds: string[]
  displayName: string | null
  setupCompleted: boolean
  uploadToken: string | null
}

export async function getUserSettings(): Promise<UserSettings> {
  'use cache'
  cacheTag('user-settings')
  const { data } = await getSupabaseClient()
    .from('user_settings')
    .select('upi_ids, display_name, setup_completed, upload_token')
    .eq('id', 'default')
    .single()
  return {
    upiIds: (data?.upi_ids as string[]) ?? [],
    displayName: (data?.display_name as string | null) ?? null,
    setupCompleted: (data?.setup_completed as boolean) ?? false,
    uploadToken: (data?.upload_token as string | null) ?? null,
  }
}

// Used by the upload route — direct uncached query, looks up by token value
export async function getOwnerByUploadToken(
  token: string,
): Promise<{ displayName: string | null; upiIds: string[] } | null> {
  const { data } = await getSupabaseClient()
    .from('user_settings')
    .select('display_name, upi_ids')
    .eq('upload_token', token)
    .single()
  if (!data) return null
  return {
    displayName: (data.display_name as string | null) ?? null,
    upiIds: (data.upi_ids as string[]) ?? [],
  }
}
