import { NextRequest, NextResponse } from 'next/server'
import { db, accountsDb, settingsDb, categoriesDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'

export async function GET(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const userId = auth.userId

  const [transactions, accounts, settings, categories] = await Promise.all([
    db.getAll(userId),
    accountsDb.getAll(userId),
    settingsDb.get(userId),
    categoriesDb.getCustomWithColors(userId),
  ])

  const categoryColors: Record<string, string> = {}
  for (const c of categories) {
    categoryColors[c.name] = c.color
  }

  return NextResponse.json({
    transactions,
    accounts,
    settings: {
      display_name: settings.displayName,
      expected_monthly_income: settings.expectedMonthlyIncome,
    },
    categoryColors,
  })
}
