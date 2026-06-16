import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'
import type { Transaction } from '@paisa-buddy/shared/types/transaction'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const body = await req.json() as Partial<Omit<Transaction, 'id' | 'created_at' | 'user_id'>>

  const tx = await db.update(auth.userId, id, body)
  return NextResponse.json(tx)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  await db.delete(auth.userId, id)
  return new NextResponse(null, { status: 204 })
}
