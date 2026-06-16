import { NextRequest, NextResponse } from 'next/server'
import { budgetsDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'

export async function GET(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7)

  const budgets = await budgetsDb.getAll(auth.userId, month)
  return NextResponse.json(budgets)
}

export async function POST(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json() as { category?: string; amount?: number }
  if (!body.category || typeof body.amount !== 'number') {
    return NextResponse.json({ error: 'category and amount required' }, { status: 400 })
  }

  const budget = await budgetsDb.upsert(auth.userId, body.category, body.amount)
  return NextResponse.json(budget)
}
