import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'
import type { Transaction } from '@paisa-buddy/shared/types/transaction'

export async function POST(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json() as Partial<Transaction>

  if (!body.type || !body.amount || !body.date) {
    return NextResponse.json({ error: 'type, amount, date are required' }, { status: 400 })
  }

  const tx = await db.insert(auth.userId, {
    type: body.type,
    amount: body.amount,
    date: body.date,
    currency: 'INR',
    merchant: body.merchant ?? null,
    description: body.description ?? '',
    category: body.category ?? null,
    account_id: body.account_id ?? null,
    to_account_id: body.to_account_id ?? null,
    time: body.time ?? null,
    upi_ref: null,
    bank: null,
    source: 'manual',
    raw_ai_response: null,
    confidence: null,
    reviewed: true,
    is_recurring: body.is_recurring ?? false,
    recurrence_group: null,
    investment_id: null,
  })

  return NextResponse.json(tx, { status: 201 })
}
