import { NextRequest, NextResponse } from 'next/server'
import { settingsDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'
import { parseBody, MAX_UPI_LEN } from '@/lib/mobile-validate'

export async function POST(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await parseBody<{ id?: string }>(req)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const upiId = body.id?.trim()
  if (!upiId) return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (upiId.length > MAX_UPI_LEN) return NextResponse.json({ error: `UPI ID too long (max ${MAX_UPI_LEN})` }, { status: 400 })

  const settings = await settingsDb.get(auth.userId)
  if (!settings.upiIds.includes(upiId)) {
    await settingsDb.upsert(auth.userId, { upiIds: [...settings.upiIds, upiId] })
  }
  return new NextResponse(null, { status: 204 })
}

export async function DELETE(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await parseBody<{ id?: string }>(req)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const upiId = body.id?.trim()
  if (!upiId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const settings = await settingsDb.get(auth.userId)
  await settingsDb.upsert(auth.userId, { upiIds: settings.upiIds.filter((u) => u !== upiId) })
  return new NextResponse(null, { status: 204 })
}
