import { NextRequest, NextResponse } from 'next/server'
import { investmentsDb } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'

export async function GET(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const investments = await investmentsDb.getAll(auth.userId)
  return NextResponse.json(investments)
}

export async function POST(req: NextRequest) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json() as { name?: string }
  if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const inv = await investmentsDb.insert(auth.userId, body.name.trim())
  return NextResponse.json({ ...inv, total_invested: 0 }, { status: 201 })
}
