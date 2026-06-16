import { NextRequest, NextResponse } from 'next/server'
import { db, accountsDb, categoriesDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'

export async function GET(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const [transactions, accounts, categories] = await Promise.all([
    db.getPending(auth.userId),
    accountsDb.getAll(auth.userId),
    categoriesDb.getCustomWithColors(auth.userId),
  ])

  const categoryColors: Record<string, string> = {}
  for (const c of categories) categoryColors[c.name] = c.color

  return NextResponse.json({ transactions, accounts, categoryColors })
}

export async function DELETE(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const pending = await db.getPending(auth.userId)
  await Promise.all(pending.map((tx) => db.delete(auth.userId, tx.id)))
  return new NextResponse(null, { status: 204 })
}
