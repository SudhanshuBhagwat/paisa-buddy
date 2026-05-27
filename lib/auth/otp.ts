import 'server-only'
import { Resend } from 'resend'
import { getSupabaseClient } from '@/lib/db/supabase/client'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function generateAndSendOTP(email: string): Promise<void> {
  const token = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error } = await getSupabaseClient()
    .from('otp_tokens')
    .upsert({ email, token, expires_at: expiresAt })
  if (error) throw new Error(error.message)

  const { error: emailError } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: email,
    subject: 'Your Paisa Buddy login code',
    text: `Your login code is: ${token}\n\nThis code expires in 10 minutes. Do not share it.`,
  })
  if (emailError) throw new Error(emailError.message)
}

export async function verifyOTP(email: string, token: string): Promise<boolean> {
  const { data, error } = await getSupabaseClient()
    .from('otp_tokens')
    .select()
    .eq('email', email)
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error || !data) return false

  await getSupabaseClient().from('otp_tokens').delete().eq('email', email)
  return true
}
