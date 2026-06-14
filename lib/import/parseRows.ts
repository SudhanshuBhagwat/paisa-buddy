import type { TransactionType } from '@/lib/types/transaction'
import type { ImportRow } from '@/app/actions/import'

// ── Date parsing ────────────────────────────────────────────────────────────

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

export function parseDate(raw: string): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy4 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy4) return fmt(dmy4[3], dmy4[2], dmy4[1])

  // DD/MM/YY or DD-MM-YY
  const dmy2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/)
  if (dmy2) return fmt(String(2000 + Number(dmy2[3])), dmy2[2], dmy2[1])

  // DD MMM YYYY or DD-MMM-YYYY (e.g. "01 Jan 2024", "01-Jan-2024")
  const dmy3 = s.match(/^(\d{1,2})[\s\-]([A-Za-z]{3})[\s\-](\d{4})$/)
  if (dmy3) {
    const m = MONTHS[dmy3[2].toLowerCase()]
    if (m) return fmt(dmy3[3], m, dmy3[1])
  }

  // DD MMM'YY (e.g. "01 Jan'24")
  const dmy5 = s.match(/^(\d{1,2})\s+([A-Za-z]{3})'(\d{2})$/)
  if (dmy5) {
    const m = MONTHS[dmy5[2].toLowerCase()]
    if (m) return fmt(String(2000 + Number(dmy5[3])), m, dmy5[1])
  }

  // M/D/YYYY (US format — least preferred, try last)
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) {
    // If month > 12 it's actually DD/MM/YYYY — already handled above
    const d = new Date(s)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }

  return null
}

function fmt(y: string, m: string, d: string): string {
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

// ── Amount parsing ───────────────────────────────────────────────────────────

export function parseAmount(raw: string): number | null {
  if (!raw) return null
  let s = raw.trim()
  if (!s) return null

  // Strip parentheses for negative: (1,234.56) → negative flag
  const negative = s.startsWith('(') && s.endsWith(')')
  if (negative) s = s.slice(1, -1).trim()

  // Strip Dr/Cr suffixes
  s = s.replace(/\s*(Dr|DR|Cr|CR)\.?$/, '').trim()

  // Strip currency symbols + thousands separators
  s = s.replace(/[₹$€£,\s]/g, '')

  const n = parseFloat(s)
  if (isNaN(n) || n === 0) return null

  return negative ? -Math.abs(n) : n
}

// Returns true if raw amount string has a Dr suffix
export function hasDrSuffix(raw: string): boolean {
  return /\s*(Dr|DR)\.?$/.test(raw.trim())
}

// Returns true if raw amount string has a Cr suffix
export function hasCrSuffix(raw: string): boolean {
  return /\s*(Cr|CR)\.?$/.test(raw.trim())
}

// ── Header row detection ─────────────────────────────────────────────────────

const DATE_KW = ['date', 'txn date', 'transaction date', 'value date', 'posting date', 'tran date']
const DEBIT_KW = ['debit', 'dr', 'withdrawal', 'withdrawals', 'debit amount', 'withdrawal amt']
const CREDIT_KW = ['credit', 'cr', 'deposit', 'deposits', 'credit amount', 'deposit amt']
const AMT_KW = ['amount', 'transaction amount', 'txn amount', 'net amount']
const DESC_KW = ['description', 'narration', 'particulars', 'remarks', 'details', 'transaction details', 'payment details', 'chq/ref number']
const REF_KW = ['reference', 'ref no', 'chq no', 'utr', 'upi ref', 'transaction id', 'txn id', 'cheque']
const SKIP_KW = ['balance', 'opening', 'closing', 'available']

function scoreRow(row: string[]): number {
  const lower = row.map((c) => c.toLowerCase().trim())
  let score = 0
  const all = [...DATE_KW, ...DEBIT_KW, ...CREDIT_KW, ...AMT_KW, ...DESC_KW, ...REF_KW]
  for (const cell of lower) {
    if (all.some((k) => cell.includes(k))) score++
    if (SKIP_KW.some((k) => cell.includes(k))) score-- // balance columns are not headers we want
  }
  return score
}

export function detectHeaderRow(rows: string[][]): number {
  let best = 0
  let bestIdx = 0
  const scanLimit = Math.min(rows.length, 30)
  for (let i = 0; i < scanLimit; i++) {
    const s = scoreRow(rows[i])
    if (s > best) { best = s; bestIdx = i }
  }
  return bestIdx
}

// ── Column auto-mapping ──────────────────────────────────────────────────────

export interface ColumnMapping {
  dateCol: string
  descCol: string
  refCol: string
  amountMode: 'split' | 'single'
  debitCol: string    // split mode
  creditCol: string   // split mode
  amountCol: string   // single mode
  positiveIsCredit: boolean // single mode: whether positive = credit
}

export function autoMapColumns(headers: string[]): ColumnMapping {
  const lower = headers.map((h) => h.toLowerCase().trim())

  function best(keywords: string[]): string {
    for (const kw of keywords) {
      const idx = lower.findIndex((h) => h.includes(kw))
      if (idx !== -1) return headers[idx]
    }
    return ''
  }

  const dateCol = best(DATE_KW)
  const descCol = best(DESC_KW)
  const refCol = best(REF_KW)
  const debitCol = best(DEBIT_KW)
  const creditCol = best(CREDIT_KW)
  const amountCol = best(AMT_KW) || best(['amount'])

  const amountMode: 'split' | 'single' = debitCol && creditCol ? 'split' : 'single'

  return {
    dateCol,
    descCol,
    refCol,
    amountMode,
    debitCol,
    creditCol,
    amountCol: amountMode === 'single' ? (amountCol || debitCol || creditCol) : '',
    positiveIsCredit: false,
  }
}

// ── Transaction building ─────────────────────────────────────────────────────

export function applyMapping(
  rows: string[][],
  headers: string[],
  headerRowIdx: number,
  mapping: ColumnMapping,
): ImportRow[] {
  const colIdx = (name: string): number => headers.indexOf(name)

  const dateIdx = colIdx(mapping.dateCol)
  const descIdx = colIdx(mapping.descCol)
  const refIdx = colIdx(mapping.refCol)
  const debitIdx = colIdx(mapping.debitCol)
  const creditIdx = colIdx(mapping.creditCol)
  const amountIdx = colIdx(mapping.amountCol)

  const result: ImportRow[] = []

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const get = (idx: number): string => (idx >= 0 ? (row[idx] ?? '') : '')

    const dateStr = get(dateIdx)
    const date = parseDate(dateStr)
    if (!date) continue

    let type: TransactionType
    let amount_paise: number

    if (mapping.amountMode === 'split') {
      const debitRaw = get(debitIdx)
      const creditRaw = get(creditIdx)
      const debit = parseAmount(debitRaw)
      const credit = parseAmount(creditRaw)

      if (debit && Math.abs(debit) > 0 && (!credit || Math.abs(credit) === 0)) {
        type = 'debit'
        amount_paise = Math.round(Math.abs(debit) * 100)
      } else if (credit && Math.abs(credit) > 0 && (!debit || Math.abs(debit) === 0)) {
        type = 'credit'
        amount_paise = Math.round(Math.abs(credit) * 100)
      } else {
        continue // both empty or both filled — skip ambiguous row
      }
    } else {
      const amtRaw = get(amountIdx)
      const amt = parseAmount(amtRaw)
      if (!amt || amt === 0) continue

      // Dr/Cr suffix takes precedence
      if (hasDrSuffix(amtRaw)) {
        type = 'debit'
        amount_paise = Math.round(Math.abs(amt) * 100)
      } else if (hasCrSuffix(amtRaw)) {
        type = 'credit'
        amount_paise = Math.round(Math.abs(amt) * 100)
      } else if (amt < 0) {
        // Negative amount
        type = mapping.positiveIsCredit ? 'debit' : 'credit'
        amount_paise = Math.round(Math.abs(amt) * 100)
      } else {
        type = mapping.positiveIsCredit ? 'credit' : 'debit'
        amount_paise = Math.round(Math.abs(amt) * 100)
      }
    }

    if (amount_paise <= 0) continue

    const description = get(descIdx) || get(dateIdx + 1) || ''
    const upi_ref = get(refIdx) || null

    result.push({ date, type, amount_paise, description, upi_ref })
  }

  return result
}
