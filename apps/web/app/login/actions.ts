'use server'

import { z } from 'zod'
import { signIn } from '@/auth'
import { generateAndSendOTP } from '@/lib/auth/otp'

export type RequestOTPState = { error?: string; email?: string }
export type VerifyOTPState = { error?: string }

export async function requestOTP(
  _prev: RequestOTPState,
  formData: FormData,
): Promise<RequestOTPState> {
  const parsed = z.string().email().safeParse(formData.get('email'))
  if (!parsed.success) return { error: 'Enter a valid email address.' }

  try {
    await generateAndSendOTP(parsed.data)
    return { email: parsed.data }
  } catch (err) {
    console.error('[requestOTP]', err)
    return { error: 'Failed to send code. Try again.' }
  }
}

export async function verifyOTPAndSignIn(
  _prev: VerifyOTPState,
  formData: FormData,
): Promise<VerifyOTPState> {
  const email = formData.get('email') as string
  const token = formData.get('token') as string

  if (!token || token.length !== 6) return { error: 'Enter the 6-digit code.' }

  try {
    await signIn('credentials', { email, token, redirectTo: '/' })
    return {}
  } catch (err) {
    // signIn throws NEXT_REDIRECT on success — re-throw it
    if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) throw err
    return { error: 'Invalid or expired code. Try again.' }
  }
}
