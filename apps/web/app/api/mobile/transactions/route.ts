import { NextRequest, NextResponse } from 'next/server'
import { accountsDb, categoriesDb, db } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'
import { parseBody, VALID_TX_TYPES, isPositiveInt, isValidDate, isValidMonth, MAX_DESC_LEN, MAX_NAME_LEN } from '@/lib/mobile-validate'
import type { Transaction } from '@paisa-buddy/shared/types/transaction'

function monthBounds(month: string): { dateFrom: string; dateTo: string } {
  const [year, monthNum] = month.split('-')
  const lastDay = new Date(Number(year), Number(monthNum), 0).getDate().toString().padStart(2, '0')
  return { dateFrom: `${year}-${monthNum}-01`, dateTo: `${year}-${monthNum}-${lastDay}` }
}

export async function GET(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7)

  if (!isValidMonth(month)) {
    return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 })
  }

  const { dateFrom, dateTo } = monthBounds(month)
  const [transactions, monthlySpends, accounts, categories] = await Promise.all([
    db.getAll(auth.userId, { dateFrom, dateTo }),
    db.getMonthlySpends(auth.userId),
    accountsDb.getAll(auth.userId),
    categoriesDb.getCustomWithColors(auth.userId),
  ])

  const categoryColors: Record<string, string> = {}
  for (const c of categories) categoryColors[c.name] = c.color

  return NextResponse.json({ transactions, monthlySpends, accounts, categoryColors })
}

export async function POST(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await parseBody<Partial<Transaction>>(req)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  if (!body.type || !VALID_TX_TYPES.has(body.type)) {
    return NextResponse.json({ error: 'type must be debit, credit, or transfer' }, { status: 400 })
  }
  if (!isPositiveInt(body.amount)) {
    return NextResponse.json({ error: 'amount must be a positive integer (paise)' }, { status: 400 })
  }
  if (!isValidDate(body.date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
  }
  if (body.merchant && body.merchant.length > MAX_NAME_LEN) {
    return NextResponse.json({ error: `merchant too long (max ${MAX_NAME_LEN})` }, { status: 400 })
  }
  if (body.description && body.description.length > MAX_DESC_LEN) {
    return NextResponse.json({ error: `description too long (max ${MAX_DESC_LEN})` }, { status: 400 })
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
