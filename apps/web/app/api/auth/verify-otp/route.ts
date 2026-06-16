import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyOTP } from '@/lib/auth/otp'
import { getOrCreateUserId } from '@/lib/auth/users'
import { getSupabaseClient } from '@/lib/db/supabase/client'

const schema = z.object({
  email: z.string().email(),
  token: z.string().length(6),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { email, token } = parsed.data

  // 1. Verify the custom OTP against otp_tokens table
  const valid = await verifyOTP(email, token)
  if (!valid) return NextResponse.json({ error: 'Invalid or expired code.' }, { status: 401 })

  // 2. Ensure user exists in our custom users table
  const customUserId = await getOrCreateUserId(email)

  const supabase = getSupabaseClient()

  // 3. Upsert user into Supabase auth.users using the same UUID as the custom
  //    users table so that auth.uid() === user_settings.user_id for new users.
  //    For users who already have a mismatched auth entry this will fail — that
  //    is fine; setup-status is resolved via email lookup on the API side.
  await supabase.auth.admin.createUser({ email, email_confirm: true, id: customUserId })

  // 4. Generate a single-use magic-link token for the mobile to exchange for a session
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkErr || !linkData) {
    console.error('[api/auth/verify-otp] generateLink failed', linkErr)
    return NextResponse.json({ error: 'Session creation failed. Try again.' }, { status: 500 })
  }

  return NextResponse.json({
    supabaseToken: linkData.properties.hashed_token,
  })
}
