import 'server-only'
import type { NextRequest } from 'next/server'
import { getSupabaseClient } from '@/lib/db/supabase/client'

type AuthOk = { userId: string }
type AuthErr = { error: string; status: number }

export async function resolveMobileUser(req: NextRequest): Promise<AuthOk | AuthErr> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return { error: 'Missing token', status: 401 }

  const supabase = getSupabaseClient()
  const { data: { user }, error: jwtErr } = await supabase.auth.getUser(token)
  if (jwtErr || !user?.email) return { error: 'Invalid token', status: 401 }

  const { data: customUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', user.email)
    .maybeSingle()

  if (!customUser?.id) return { error: 'User not found', status: 404 }
  return { userId: customUser.id as string }
}

export function isAuthErr(r: AuthOk | AuthErr): r is AuthErr {
  return 'error' in r
}
