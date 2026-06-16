import { NextRequest, NextResponse } from 'next/server'
import { accountsDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'
import { parseBody, VALID_ACCOUNT_TYPES, isNonNegativeInt, MAX_NAME_LEN } from '@/lib/mobile-validate'
import type { AccountType } from '@paisa-buddy/shared/types/account'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await parseBody<{ name?: string; type?: AccountType; bank?: string; opening_balance?: number }>(req)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
    if (name.length > MAX_NAME_LEN) return NextResponse.json({ error: `name too long (max ${MAX_NAME_LEN})` }, { status: 400 })
  }
  if (body.type !== undefined && !VALID_ACCOUNT_TYPES.has(body.type)) {
    return NextResponse.json({ error: 'type must be savings, current, credit, wallet, or other' }, { status: 400 })
  }
  if (body.opening_balance !== undefined && !isNonNegativeInt(body.opening_balance)) {
    return NextResponse.json({ error: 'opening_balance must be a non-negative integer (paise)' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name.trim()
  if (body.type !== undefined) data.type = body.type
  if (body.bank !== undefined) data.bank = body.bank?.trim() || null
  if (body.opening_balance !== undefined) data.opening_balance = body.opening_balance

  const { id } = await params
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
