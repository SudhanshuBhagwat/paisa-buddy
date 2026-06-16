import { NextRequest, NextResponse } from 'next/server'
import { accountsDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'
import { parseBody, VALID_ACCOUNT_TYPES, isNonNegativeInt, MAX_NAME_LEN } from '@/lib/mobile-validate'
import type { AccountType } from '@paisa-buddy/shared/types/account'

export async function GET(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const accounts = await accountsDb.getAll(auth.userId)
  return NextResponse.json(accounts)
}

export async function POST(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await parseBody<{ name?: string; type?: AccountType; bank?: string; opening_balance?: number }>(req)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const name = body.name?.trim()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (name.length > MAX_NAME_LEN) return NextResponse.json({ error: `name too long (max ${MAX_NAME_LEN})` }, { status: 400 })

  const type = body.type ?? 'savings'
  if (!VALID_ACCOUNT_TYPES.has(type)) {
    return NextResponse.json({ error: 'type must be savings, current, credit, wallet, or other' }, { status: 400 })
  }

  if (body.opening_balance !== undefined && !isNonNegativeInt(body.opening_balance)) {
    return NextResponse.json({ error: 'opening_balance must be a non-negative integer (paise)' }, { status: 400 })
  }

  const acc = await accountsDb.insert(auth.userId, {
    name,
    type,
    bank: body.bank?.trim() || null,
    currency: 'INR',
    opening_balance: body.opening_balance ?? 0,
  })
  return NextResponse.json(acc, { status: 201 })
}
