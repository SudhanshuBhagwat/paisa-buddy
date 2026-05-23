import { type NextRequest } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { revalidateTag } from 'next/cache'
import vision from '@/lib/vision'
import db from '@/lib/db'
import { getUserSettings } from '@/lib/db/user-settings'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif'])
const MAX_BYTES = 10 * 1024 * 1024 // 10MB

function isAuthorized(req: NextRequest): boolean {
  const token = req.headers.get('x-upload-token')
  const secret = process.env.UPLOAD_SECRET
  if (!token || !secret) return false
  // timingSafeEqual requires same-length buffers — catch throws as failure
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  } catch {
    return false
  }
}

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
    source: 'receipt_ocr',
    raw_ai_response: JSON.stringify(parsed), // includes category_hint for review UI
    confidence: parsed.confidence,
    reviewed: false,
  })

  return tx.id
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
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

  const { displayName, upiIds } = await getUserSettings()
  const results = await Promise.allSettled(files.map((f) => processFile(f, { displayName, upiIds })))

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

  if (queued > 0) revalidateTag('transactions')

  return Response.json({ queued, errors })
}
