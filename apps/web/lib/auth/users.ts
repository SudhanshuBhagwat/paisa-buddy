import 'server-only'
import { getSupabaseClient } from '@/lib/db/supabase/client'

/**
 * Returns the UUID for a user by email, creating a row on first login.
 * Called once per login inside the NextAuth authorize() callback.
 */
export async function getOrCreateUserId(email: string): Promise<string> {
  const client = getSupabaseClient()

  // Fast path: user already exists.
  const { data: existing } = await client
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing?.id) return existing.id as string

  // First login: create the user row.
  const { data: created, error } = await client
    .from('users')
    .insert({ email })
    .select('id')
    .single()

  if (error || !created) throw new Error(error?.message ?? 'Failed to create user')
  return created.id as string
}
