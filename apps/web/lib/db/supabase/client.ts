import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

// This is the ONLY file in the codebase that imports @supabase/supabase-js.
// All other DB code goes through the repository interfaces in lib/db/types.ts.

let _client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    _client = createClient(url, key, { auth: { persistSession: false } })
  }
  return _client
}
