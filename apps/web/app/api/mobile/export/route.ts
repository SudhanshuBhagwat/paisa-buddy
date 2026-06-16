import { NextRequest, NextResponse } from 'next/server'
import { db, accountsDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'

function escCsv(v: string | null | undefined): string {
  const s = v ?? ''
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const [transactions, accounts] = await Promise.all([
    db.getAll(auth.userId),
    accountsDb.getAll(auth.userId),
  ])

  const accountMap = new Map(accounts.map((a) => [a.id, a.name]))

  const rows: string[] = [
    'Date,Time,Merchant,Description,Category,Type,Amount (₹),Account,Recurring,Reviewed',
    ...transactions
      .sort((a, b) => b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? ''))
      .map((tx) => [
        escCsv(tx.date),
        escCsv(tx.time),
        escCsv(tx.merchant),
        escCsv(tx.description),
        escCsv(tx.category),
        escCsv(tx.type),
        (tx.amount / 100).toFixed(2),
        escCsv(tx.account_id ? accountMap.get(tx.account_id) ?? '' : ''),
        tx.is_recurring ? 'Yes' : '',
        tx.reviewed ? 'Yes' : '',
      ].join(',')),
  ]

  const csv = rows.join('\n')
  const today = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="paisa-buddy-${today}.csv"`,
    },
  })
}
