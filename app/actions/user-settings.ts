'use server'

import { updateTag } from 'next/cache'
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
}

export async function removeUpiId(upiId: string): Promise<void> {
  const { upiIds } = await getUserSettings()
  await getSupabaseClient()
    .from('user_settings')
    .update({ upi_ids: upiIds.filter((id) => id !== upiId) })
    .eq('id', 'default')
  updateTag('user-settings')
}

export async function setDisplayName(name: string): Promise<void> {
  await getSupabaseClient()
    .from('user_settings')
    .update({ display_name: name || null })
    .eq('id', 'default')
  updateTag('user-settings')
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
}
