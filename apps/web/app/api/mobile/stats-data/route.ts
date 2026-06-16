import { NextRequest, NextResponse } from 'next/server'
import { db, budgetsDb, categoriesDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'
import { getMonthTransactions } from '@paisa-buddy/shared/logic/transaction'

export async function GET(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7)

  const [allTxs, budgets, categories] = await Promise.all([
    db.getAll(auth.userId),
    budgetsDb.getAll(auth.userId, month),
    categoriesDb.getCustomWithColors(auth.userId),
  ])

  const transactions = getMonthTransactions(allTxs, month)

  const categoryColors: Record<string, string> = {}
  for (const c of categories) categoryColors[c.name] = c.color

  return NextResponse.json({ transactions, budgets, categoryColors })
}
