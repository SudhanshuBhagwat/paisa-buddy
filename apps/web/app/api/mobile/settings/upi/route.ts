import { NextRequest, NextResponse } from 'next/server'
import { settingsDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'

export async function POST(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json() as { id?: string }
  const upiId = body.id?.trim()
  if (!upiId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const settings = await settingsDb.get(auth.userId)
  if (!settings.upiIds.includes(upiId)) {
    await settingsDb.upsert(auth.userId, { upiIds: [...settings.upiIds, upiId] })
  }
  return new NextResponse(null, { status: 204 })
}

export async function DELETE(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json() as { id?: string }
  const upiId = body.id?.trim()
  if (!upiId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const settings = await settingsDb.get(auth.userId)
  await settingsDb.upsert(auth.userId, { upiIds: settings.upiIds.filter((u) => u !== upiId) })
  return new NextResponse(null, { status: 204 })
}
