import { NextRequest, NextResponse } from 'next/server'
import { accountsDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'
import type { AccountType } from '@paisa-buddy/shared/types/account'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const body = await req.json() as { name?: string; type?: AccountType; bank?: string; opening_balance?: number }

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name.trim()
  if (body.type !== undefined) data.type = body.type
  if (body.bank !== undefined) data.bank = body.bank?.trim() || null
  if (body.opening_balance !== undefined) data.opening_balance = body.opening_balance

  const acc = await accountsDb.update(auth.userId, id, data)
  return NextResponse.json(acc)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  await accountsDb.delete(auth.userId, id)
  return new NextResponse(null, { status: 204 })
}
