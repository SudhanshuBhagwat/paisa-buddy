import { NextRequest, NextResponse } from 'next/server'
import { db, accountsDb, budgetsDb, categoriesDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'
import { isValidMonth } from '@/lib/mobile-validate'
import { getMonthTransactions } from '@paisa-buddy/shared/logic/transaction'

export async function GET(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7)

  if (!isValidMonth(month)) {
    return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 })
  }

  const [allTxs, budgets, categories, accounts] = await Promise.all([
    db.getAll(auth.userId),
    budgetsDb.getAll(auth.userId, month),
    categoriesDb.getCustomWithColors(auth.userId),
    accountsDb.getAll(auth.userId),
  ])

  const transactions = getMonthTransactions(allTxs, month)

  const categoryColors: Record<string, string> = {}
  for (const c of categories) categoryColors[c.name] = c.color

  return NextResponse.json({ transactions, budgets, categoryColors, accounts })
}
