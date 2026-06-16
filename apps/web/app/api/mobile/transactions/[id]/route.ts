import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveMobileUser, isAuthErr } from '@/lib/mobile-auth'
import { parseBody, VALID_TX_TYPES, isPositiveInt, isValidDate, MAX_DESC_LEN, MAX_NAME_LEN } from '@/lib/mobile-validate'
import type { Transaction } from '@paisa-buddy/shared/types/transaction'

type PatchableFields = Pick<
  Transaction,
  'type' | 'amount' | 'date' | 'time' | 'merchant' | 'description' | 'category' | 'account_id' | 'to_account_id' | 'reviewed' | 'is_recurring'
>

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await parseBody<Partial<PatchableFields>>(req)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  if (body.type !== undefined && !VALID_TX_TYPES.has(body.type)) {
    return NextResponse.json({ error: 'type must be debit, credit, or transfer' }, { status: 400 })
  }
  if (body.amount !== undefined && !isPositiveInt(body.amount)) {
    return NextResponse.json({ error: 'amount must be a positive integer (paise)' }, { status: 400 })
  }
  if (body.date !== undefined && !isValidDate(body.date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
  }
  if (body.merchant && body.merchant.length > MAX_NAME_LEN) {
    return NextResponse.json({ error: `merchant too long (max ${MAX_NAME_LEN})` }, { status: 400 })
  }
  if (body.description && body.description.length > MAX_DESC_LEN) {
    return NextResponse.json({ error: `description too long (max ${MAX_DESC_LEN})` }, { status: 400 })
  }

  // Build update from whitelisted fields only — block source, raw_ai_response, confidence, etc.
  const update: Partial<PatchableFields> = {}
  if (body.type       !== undefined) update.type        = body.type
  if (body.amount     !== undefined) update.amount      = body.amount
  if (body.date       !== undefined) update.date        = body.date
  if (body.time       !== undefined) update.time        = body.time
  if (body.merchant   !== undefined) update.merchant    = body.merchant
  if (body.description !== undefined) update.description = body.description
  if (body.category   !== undefined) update.category    = body.category
  if (body.account_id !== undefined) update.account_id  = body.account_id
  if (body.to_account_id !== undefined) update.to_account_id = body.to_account_id
  if (body.reviewed   !== undefined) update.reviewed    = body.reviewed
  if (body.is_recurring !== undefined) update.is_recurring = body.is_recurring

  const { id } = await params
  const tx = await db.update(auth.userId, id, update)
  return NextResponse.json(tx)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMobileUser(req)
  if (isAuthErr(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  await db.delete(auth.userId, id)
  return new NextResponse(null, { status: 204 })
}
