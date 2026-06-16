import { NextRequest, NextResponse } from 'next/server'
import { budgetsDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'
import { parseBody, isPositiveInt, isValidMonth, MAX_NAME_LEN } from '@/lib/mobile-validate'

export async function GET(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7)

  if (!isValidMonth(month)) {
    return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 })
  }

  const budgets = await budgetsDb.getAll(auth.userId, month)
  return NextResponse.json(budgets)
}

export async function POST(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await parseBody<{ category?: string; amount?: number }>(req)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  if (!body.category?.trim()) {
    return NextResponse.json({ error: 'category required' }, { status: 400 })
  }
  if (body.category.length > MAX_NAME_LEN) {
    return NextResponse.json({ error: `category too long (max ${MAX_NAME_LEN})` }, { status: 400 })
  }
  if (!isPositiveInt(body.amount)) {
    return NextResponse.json({ error: 'amount must be a positive integer (paise)' }, { status: 400 })
  }

  const budget = await budgetsDb.upsert(auth.userId, body.category, body.amount)
  return NextResponse.json(budget)
}
