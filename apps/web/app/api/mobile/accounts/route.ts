import { NextRequest, NextResponse } from 'next/server'
import { accountsDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'
import type { AccountType } from '@paisa-buddy/shared/types/account'

export async function POST(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json() as { name: string; type?: AccountType }
  if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const acc = await accountsDb.insert(auth.userId, {
    name: body.name.trim(),
    type: body.type ?? 'savings',
    bank: null,
    currency: 'INR',
    opening_balance: 0,
  })
  return NextResponse.json(acc, { status: 201 })
}
