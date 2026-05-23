'use server'

import { randomBytes } from 'crypto'
import { updateTag, refresh } from 'next/cache'
import { getSupabaseClient } from '@/lib/db/supabase-client'
import { getUserSettings } from '@/lib/db/user-settings'

export async function addUpiId(upiId: string): Promise<void> {
  const { upiIds } = await getUserSettings()
  if (upiIds.includes(upiId)) return
  await getSupabaseClient()
    .from('user_settings')
    .update({ upi_ids: [...upiIds, upiId] })
    .eq('id', 'default')
  updateTag('user-settings')
  refresh()
}

export async function removeUpiId(upiId: string): Promise<void> {
  const { upiIds } = await getUserSettings()
  await getSupabaseClient()
    .from('user_settings')
    .update({ upi_ids: upiIds.filter((id) => id !== upiId) })
    .eq('id', 'default')
  updateTag('user-settings')
  refresh()
}

export async function setDisplayName(name: string): Promise<void> {
  await getSupabaseClient()
    .from('user_settings')
    .update({ display_name: name || null })
    .eq('id', 'default')
  updateTag('user-settings')
  refresh()
}

export async function ensureUploadToken(): Promise<string> {
  // Direct DB read (bypasses cache) so we always see the current value
  const { data } = await getSupabaseClient()
    .from('user_settings')
    .select('upload_token')
    .eq('id', 'default')
    .single()
  if (data?.upload_token) return data.upload_token as string

  const token = randomBytes(32).toString('hex')
  await getSupabaseClient()
    .from('user_settings')
    .update({ upload_token: token })
    .eq('id', 'default')
  updateTag('user-settings')
  return token
}

export async function regenerateUploadToken(): Promise<string> {
  const token = randomBytes(32).toString('hex')
  await getSupabaseClient()
    .from('user_settings')
    .update({ upload_token: token })
    .eq('id', 'default')
  updateTag('user-settings')
  refresh()
  return token
}

export async function completeSetup(displayName: string, upiIds: string[]): Promise<void> {
  await getSupabaseClient()
    .from('user_settings')
    .upsert({
      id: 'default',
      display_name: displayName || null,
      upi_ids: upiIds,
      setup_completed: true,
    })
  updateTag('user-settings')
  refresh()
}
