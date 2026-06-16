import 'server-only'
import { db } from '@/lib/db'
import type { ImportRow } from '@/app/actions/import'

/**
 * Produces a string key that uniquely identifies a transaction for dedup purposes.
 *
 * Strong key  (upi_ref present): "upi:<ref>"  — globally unique per UPI network
 * Weak key    (no upi_ref):      "tx:<date>|<paise>|<type>|<desc50>"
 *
 * Remaining gap: two legitimately identical non-UPI transactions on the same day
 * (e.g. two ₹500 ATM withdrawals) share the same weak key and one will be skipped.
 * This is rare and preferable to importing duplicate bank statement rows.
 */
export function txFingerprint(row: {
  date: string
  amount_paise: number
  type: string
  upi_ref: string | null
  description: string
}): string {
  const ref = row.upi_ref?.trim()
  if (ref) return `upi:${ref}`
  const desc = row.description
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50)
  return `tx:${row.date}|${row.amount_paise}|${row.type}|${desc}`
}

/**
 * Returns a Set of fingerprints for existing transactions in the given account
 * that overlap the date range of the incoming rows.
 */
export async function buildExistingFingerprints(
  userId: string,
  accountId: string,
  rows: ImportRow[],
): Promise<Set<string>> {
  if (rows.length === 0) return new Set()

  const dates = rows.map((r) => r.date).sort()
  const dateFrom = dates[0]
  const dateTo = dates[dates.length - 1]

  const existing = await db.getAll(userId, { dateFrom, dateTo })

  const set = new Set<string>()
  for (const tx of existing) {
    if (tx.account_id !== accountId) continue
    set.add(
      txFingerprint({
        date: tx.date,
        amount_paise: tx.amount,
        type: tx.type,
        upi_ref: tx.upi_ref,
        description: tx.description,
      }),
    )
  }
  return set
}
