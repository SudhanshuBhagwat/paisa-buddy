import { NextRequest, NextResponse } from 'next/server'
import { investmentsDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'
import { parseBody, MAX_NAME_LEN } from '@/lib/mobile-validate'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await parseBody<{ name?: string }>(req)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const name = body.name?.trim()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (name.length > MAX_NAME_LEN) return NextResponse.json({ error: `name too long (max ${MAX_NAME_LEN})` }, { status: 400 })

  const { id } = await params
  const inv = await investmentsDb.update(auth.userId, id, name)
  return NextResponse.json(inv)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  await investmentsDb.delete(auth.userId, id)
  return new NextResponse(null, { status: 204 })
}
