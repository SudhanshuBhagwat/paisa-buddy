import { type NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import vision from '@/lib/vision'
import db from '@/lib/db'
import { getOwnerByUploadToken } from '@/lib/db/user-settings'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif'])
const MAX_BYTES = 10 * 1024 * 1024 // 10MB

async function processFile(file: File, owner: { displayName: string | null; upiIds: string[] }): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(`Unsupported type: ${file.type}`)
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`File exceeds 10MB limit`)
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  const parsed = await vision.parseReceipt(base64, file.type, {
    displayName: owner.displayName,
    upiIds: owner.upiIds,
  })

  const tx = await db.insert({
    type: parsed.type,
    amount: parsed.amount,
    currency: parsed.currency,
    date: parsed.date,
    time: parsed.time,
    merchant: parsed.merchant,
    description: parsed.description,
    upi_ref: parsed.upi_ref,
    bank: parsed.bank,
    // category set to null — AI hint is advisory; reviewer sets it in /review
    category: null,
    account_id: null,
    to_account_id: null,
    source: 'receipt_ocr',
    raw_ai_response: JSON.stringify(parsed), // includes category_hint for review UI
    confidence: parsed.confidence,
    reviewed: false,
  })

  return tx.id
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-upload-token') ?? ''
  const owner = await getOwnerByUploadToken(token)
  if (!owner) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const files = formData.getAll('file') as File[]
  if (files.length === 0) {
    return Response.json({ error: 'No files provided' }, { status: 400 })
  }

  const results = await Promise.allSettled(files.map((f) => processFile(f, owner)))

  let queued = 0
  const errors: string[] = []

  for (const result of results) {
    if (result.status === 'fulfilled') {
      queued++
    } else {
      console.error('[receipts/upload] Image processing failed:', result.reason)
      errors.push('One image could not be processed')
    }
  }

  if (queued > 0) revalidateTag('transactions', { expire: 0 })

  return Response.json({ queued, errors })
}
