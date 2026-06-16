import { NextRequest, NextResponse } from 'next/server'
import { db, categoriesDb, settingsDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'
import { CATEGORY_COLORS } from '@paisa-buddy/shared/categories'

export async function GET(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const [settings, customCats, allTxs] = await Promise.all([
    settingsDb.get(auth.userId),
    categoriesDb.getCustomWithColors(auth.userId),
    db.getAll(auth.userId),
  ])

  // Count transactions per category
  const catCounts: Record<string, number> = {}
  for (const tx of allTxs) {
    if (tx.category) catCounts[tx.category] = (catCounts[tx.category] ?? 0) + 1
  }

  const customCategories = customCats.map((c) => ({
    name: c.name, color: c.color, transactionCount: catCounts[c.name] ?? 0,
  }))

  const predefinedCategories = Object.keys(CATEGORY_COLORS).map((name) => ({
    name, transactionCount: catCounts[name] ?? 0,
  }))

  return NextResponse.json({
    displayName: settings.displayName,
    expectedMonthlyIncome: settings.expectedMonthlyIncome,
    upiIds: settings.upiIds,
    customCategories,
    predefinedCategories,
    txCount: allTxs.length,
  })
}
