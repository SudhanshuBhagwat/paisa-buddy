import { NextRequest, NextResponse } from 'next/server'
import { settingsDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'

export async function PATCH(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json() as { displayName?: string | null; expectedMonthlyIncome?: number }
  const data: Parameters<typeof settingsDb.upsert>[1] = {}

  if ('displayName' in body) data.displayName = body.displayName ?? null
  if ('expectedMonthlyIncome' in body) data.expectedMonthlyIncome = body.expectedMonthlyIncome

  await settingsDb.upsert(auth.userId, data)
  return new NextResponse(null, { status: 204 })
}
