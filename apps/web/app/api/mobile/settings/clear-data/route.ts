import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'

export async function POST(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  await db.deleteAll(auth.userId)
  return new NextResponse(null, { status: 204 })
}
