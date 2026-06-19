import { NextRequest, NextResponse } from 'next/server'
import { db, accountsDb, budgetsDb, categoriesDb, settingsDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'
import { isValidMonth } from '@/lib/mobile-validate'

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
  const [y, m] = month.split('-').map(Number)
  const prevDate = new Date(y, m - 2, 1)
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const { dateFrom: prevDateFrom, dateTo: prevDateTo } = monthBounds(prevMonth)

  const [transactions, prevTransactions, monthlySpends, budgets, categories, accounts, settings] = await Promise.all([
    db.getAll(auth.userId, { dateFrom, dateTo }),
    db.getAll(auth.userId, { dateFrom: prevDateFrom, dateTo: prevDateTo }),
    db.getMonthlySpends(auth.userId),
    budgetsDb.getAll(auth.userId, month),
    categoriesDb.getCustomWithColors(auth.userId),
    accountsDb.getAll(auth.userId),
    settingsDb.get(auth.userId),
  ])

  const categoryColors: Record<string, string> = {}
  for (const c of categories) categoryColors[c.name] = c.color

  const prevCatMap: Record<string, number> = {}
  for (const tx of prevTransactions) {
    if (tx.type !== 'debit' || tx.category === null) continue
    prevCatMap[tx.category] = (prevCatMap[tx.category] ?? 0) + tx.amount
  }
  const previousMonthCategorySpends = Object.entries(prevCatMap).map(([category, total]) => ({ category, total }))

  return NextResponse.json({
    transactions,
    monthlySpends,
    budgets,
    categoryColors,
    accounts,
    settings: { expected_monthly_income: settings.expectedMonthlyIncome },
    previousMonthCategorySpends,
  })
}
