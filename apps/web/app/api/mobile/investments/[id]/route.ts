import { NextRequest, NextResponse } from 'next/server'
import { investmentsDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const body = await req.json() as { name?: string }
  if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const inv = await investmentsDb.update(auth.userId, id, body.name.trim())
  return NextResponse.json(inv)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  await investmentsDb.delete(auth.userId, id)
  return new NextResponse(null, { status: 204 })
}
