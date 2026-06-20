import type { Transaction } from '@paisa-buddy/shared/types/transaction'
import type { ImportRow } from './importParser'

type FingerprintInput = {
  date: string
  amount: number
  type: string
  upi_ref: string | null
  description: string
}

export function importFingerprint(row: FingerprintInput): string {
  const ref = normalizeRef(row.upi_ref) || extractRef(row.description)
  if (ref) return `ref:${ref}`

  return [
    'tx',
    row.date,
    row.amount,
    row.type,
    normalizeDescription(row.description),
  ].join('|')
}

export function buildExistingImportFingerprints(
  transactions: Transaction[],
  accountId: string,
): Set<string> {
  const set = new Set<string>()

  for (const tx of transactions) {
    if (tx.account_id !== accountId) continue
    set.add(importFingerprint({
      date: tx.date,
      amount: tx.amount,
      type: tx.type,
      upi_ref: tx.upi_ref,
      description: tx.description,
    }))
  }

  return set
}

export function dedupeImportRows(
  rows: ImportRow[],
  existing: Set<string>,
): { rows: ImportRow[]; skipped: number } {
  const seen = new Set(existing)
  const unique: ImportRow[] = []
  let skipped = 0

  for (const row of rows) {
    const fp = importFingerprint(row)
    if (seen.has(fp)) {
      skipped++
      continue
    }
    seen.add(fp)
    unique.push(row)
  }

  return { rows: unique, skipped }
}

function normalizeRef(raw: string | null | undefined): string {
  return (raw ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').trim()
}

function extractRef(description: string): string {
  const normalized = description.toLowerCase()
  const labelled = normalized.match(/\b(?:upi|utr|rrn|ref|reference|txn|transaction)[\s:/#-]*([a-z0-9]{8,})\b/i)
  if (labelled?.[1]) return normalizeRef(labelled[1])

  const longNumeric = normalized.match(/\b\d{10,18}\b/)
  if (longNumeric?.[0]) return longNumeric[0]

  return ''
}

function normalizeDescription(description: string): string {
  return description
    .toLowerCase()
    .replace(/\b(?:upi|utr|rrn|ref|reference|txn|transaction|id|no|number)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b\d{6,}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}
