import { NextRequest, NextResponse } from 'next/server'
import { settingsDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'
import { parseBody, isNonNegativeInt, MAX_NAME_LEN } from '@/lib/mobile-validate'

export async function PATCH(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await parseBody<{ displayName?: string | null; expectedMonthlyIncome?: number }>(req)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  if ('displayName' in body && body.displayName !== null && typeof body.displayName === 'string') {
    if (body.displayName.length > MAX_NAME_LEN) {
      return NextResponse.json({ error: `displayName too long (max ${MAX_NAME_LEN})` }, { status: 400 })
    }
  }
  if ('expectedMonthlyIncome' in body && body.expectedMonthlyIncome !== undefined) {
    if (!isNonNegativeInt(body.expectedMonthlyIncome)) {
      return NextResponse.json({ error: 'expectedMonthlyIncome must be a non-negative integer (paise)' }, { status: 400 })
    }
  }

  const data: Parameters<typeof settingsDb.upsert>[1] = {}
  if ('displayName' in body) data.displayName = body.displayName ?? null
  if ('expectedMonthlyIncome' in body) data.expectedMonthlyIncome = body.expectedMonthlyIncome

  await settingsDb.upsert(auth.userId, data)
  return new NextResponse(null, { status: 204 })
}
