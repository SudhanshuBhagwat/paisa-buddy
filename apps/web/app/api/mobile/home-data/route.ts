import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/db/supabase/client'
import { db, accountsDb, settingsDb, categoriesDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 })

  const supabase = getSupabaseClient()
  const { data: { user }, error: jwtErr } = await supabase.auth.getUser(token)
  if (jwtErr || !user?.email) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // Resolve the custom users.id by email — this bridges the auth.users / custom users ID split
  const { data: customUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', user.email)
    .maybeSingle()

  if (!customUser?.id) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const userId = customUser.id as string

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
