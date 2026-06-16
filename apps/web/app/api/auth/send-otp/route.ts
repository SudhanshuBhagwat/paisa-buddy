import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateAndSendOTP } from '@/lib/auth/otp'

const schema = z.object({ email: z.string().email() })

export async function POST(req: NextRequest) {
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
