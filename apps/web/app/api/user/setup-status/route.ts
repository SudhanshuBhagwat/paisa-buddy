import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/db/supabase/client'

// Called by the mobile app to check setup status using a Supabase access token.
// The mobile user ID (auth.users) differs from the web custom users.id, so we
// bridge via email: verify the JWT → get email → look up custom user → get settings.
export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 })

  const supabase = getSupabaseClient()

  const { data: { user }, error: jwtErr } = await supabase.auth.getUser(token)
  if (jwtErr || !user?.email) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const { data: customUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', user.email)
    .maybeSingle()

  if (!customUser?.id) {
    return NextResponse.json({ setup_completed: false })
  }

  const { data: settings } = await supabase
    .from('user_settings')
    .select('setup_completed')
    .eq('user_id', customUser.id)
    .maybeSingle()

  return NextResponse.json({ setup_completed: settings?.setup_completed ?? false })
}
