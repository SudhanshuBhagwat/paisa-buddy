import { type NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { db } from '@/lib/db'
import { requireApiSession } from '@/lib/auth/require-api-session'
import { buildExistingFingerprints, txFingerprint } from '@/lib/import/dedup'
import { parseStatementPdf } from '@/lib/import/aiParsing'

// Encrypted PDFs have a /Encrypt entry in the trailer dictionary (last few KB).
function isPdfPasswordProtected(buf: Buffer): boolean {
  const tail = buf.slice(Math.max(0, buf.length - 10 * 1024))
  return tail.indexOf(Buffer.from('/Encrypt')) !== -1
}

function isUniqueViolation(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code: string }).code === '23505'
  }
  return false
}

export async function POST(req: NextRequest) {
  try {
    const authed = await requireApiSession(req)
    if (authed instanceof Response) return authed
    const { userId } = authed

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const accountId = formData.get('accountId') as string | null

    if (!file || !accountId) {
      return Response.json({ error: 'Missing file or accountId' }, { status: 400 })
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return Response.json({ error: 'File must be a PDF' }, { status: 400 })
    }
    if (file.size > 20 * 1024 * 1024) {
      return Response.json({ error: 'File exceeds 20MB limit' }, { status: 400 })
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer())

    if (isPdfPasswordProtected(fileBuffer)) {
      return Response.json(
        { error: 'This PDF is password-protected. Please remove the password before importing.' },
        { status: 422 },
      )
    }

    const transactions = await parseStatementPdf(fileBuffer.toString('base64'), file.name)

    const importRows = transactions.map((tx) => ({
      date: tx.date.slice(0, 10),
      amount_paise: Math.round(tx.amount * 100),
      type: tx.type as 'debit' | 'credit',
      description: tx.description,
      upi_ref: tx.reference,
    }))

    const existing = await buildExistingFingerprints(userId, accountId, importRows)
    let count = 0
    let skipped = 0

    for (const row of importRows) {
      const fp = txFingerprint(row)
      if (existing.has(fp)) { skipped++; continue }
      try {
        await db.insert(userId, {
          type: row.type,
          amount: row.amount_paise,
          currency: 'INR',
          date: row.date,
          time: null,
          merchant: null,
          description: row.description,
          upi_ref: row.upi_ref,
          bank: null,
          category: null,
          account_id: accountId,
          to_account_id: null,
          source: 'bank_import',
          raw_ai_response: null,
          confidence: 'medium',
          reviewed: false,
          is_recurring: false,
          recurrence_group: null,
        })
        existing.add(fp)
        count++
      } catch (err: unknown) {
        if (isUniqueViolation(err)) { skipped++ }
        else throw err
      }
    }

    if (count > 0) revalidateTag('transactions', { expire: 0 })

    return Response.json({ count, skipped })
  } catch (err) {
    console.error('[import/pdf]', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
