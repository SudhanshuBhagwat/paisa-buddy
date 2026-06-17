import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateAndSendOTP } from '@/lib/auth/otp'

const schema = z.object({ email: z.string().email() })

// In-memory rate limit: max 5 OTP requests per 10 min per IP.
// Works for single-instance deployments; use Upstash/Redis for serverless multi-instance.
const otpRateMap = new Map<string, { count: number; resetAt: number }>()
const OTP_RATE_LIMIT = 5
const OTP_RATE_WINDOW_MS = 10 * 60 * 1000

function checkOtpRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = otpRateMap.get(ip)
  if (!entry || now > entry.resetAt) {
    otpRateMap.set(ip, { count: 1, resetAt: now + OTP_RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= OTP_RATE_LIMIT) return false
  entry.count++
  return true
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!checkOtpRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })

  try {
    await generateAndSendOTP(parsed.data.email)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[api/auth/send-otp]', err)
    return NextResponse.json({ error: 'Failed to send code. Try again.' }, { status: 500 })
  }
}
