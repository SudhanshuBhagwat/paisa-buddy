import { type NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { db, settingsDb } from '@/lib/db'
import { today } from '@/lib/utils'
import type { TransactionType } from '@/lib/types/transaction'

const VALID_TYPES = new Set<TransactionType>(['debit', 'credit', 'transfer'])

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-upload-token') ?? ''
  const owner = await settingsDb.getByUploadToken(token)
  if (!owner) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { amount, type, note, date, merchant } = body as Record<string, unknown>

  const parsedAmount = typeof amount === 'string' ? Number(amount) : amount
  if (typeof parsedAmount !== 'number' || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return Response.json({ error: 'amount must be a positive number' }, { status: 400 })
  }
  const amount_paise = Math.round(parsedAmount * 100)
  const normalizedType = typeof type === 'string' ? type.toLowerCase() : type
  if (typeof normalizedType !== 'string' || !VALID_TYPES.has(normalizedType as TransactionType)) {
    return Response.json({ error: 'type must be debit, credit, or transfer' }, { status: 400 })
  }
  if (typeof note !== 'string' || !note.trim()) {
    return Response.json({ error: 'note is required' }, { status: 400 })
  }

  const txDate =
    typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today()

  const tx = await db.insert(owner.userId, {
    type: normalizedType as TransactionType,
    amount: amount_paise,
    currency: 'INR',
    date: txDate,
    time: null,
    merchant: typeof merchant === 'string' && merchant.trim() ? merchant.trim() : null,
    description: note.trim(),
    upi_ref: null,
    bank: null,
    category: null,
    account_id: null,
    to_account_id: null,
    source: 'manual',
    raw_ai_response: null,
    confidence: null,
    reviewed: false,
    is_recurring: false,
    recurrence_group: null,
  })

  revalidateTag('transactions', { expire: 0 })

  return Response.json({ queued: true, id: tx.id })
}
