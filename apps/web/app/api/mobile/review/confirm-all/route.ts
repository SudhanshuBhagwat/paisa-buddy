import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'

export async function POST(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const pending = await db.getPending(auth.userId)
  await Promise.all(pending.map((tx) => db.update(auth.userId, tx.id, { reviewed: true })))
  return new NextResponse(null, { status: 204 })
}
