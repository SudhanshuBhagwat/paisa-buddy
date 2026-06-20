import type { TransactionType } from '@paisa-buddy/shared/types/transaction'

export type ImportRow = {
  date: string
  type: TransactionType
  amount: number
  description: string
  upi_ref: string | null
}

export type ImportFormat = 'csv' | 'xlsx' | 'ofx' | 'qif'

export type ParsedImport = {
  format: ImportFormat
  rows: ImportRow[]
  skipped: number
}

type ColumnMapping = {
  dateCol: string
  descCol: string
  refCol: string
  amountMode: 'split' | 'single'
  debitCol: string
  creditCol: string
  amountCol: string
  positiveIsCredit: boolean
}

const MONTHS: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
}

const DATE_KW = ['date', 'txn date', 'transaction date', 'value date', 'posting date', 'tran date']
const DEBIT_KW = ['debit', 'dr', 'withdrawal', 'withdrawals', 'debit amount', 'withdrawal amt']
const CREDIT_KW = ['credit', 'cr', 'deposit', 'deposits', 'credit amount', 'deposit amt']
const AMT_KW = ['amount', 'transaction amount', 'txn amount', 'net amount']
const DESC_KW = ['description', 'narration', 'particulars', 'remarks', 'details', 'transaction details', 'payment details', 'chq/ref number']
const REF_KW = ['reference', 'ref no', 'chq no', 'utr', 'upi ref', 'transaction id', 'txn id', 'cheque']
const SKIP_KW = ['balance', 'opening', 'closing', 'available']

export function parseStatementText(fileName: string, text: string): ParsedImport {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.pdf')) {
    throw new Error('PDF import needs an offline PDF text extractor. Use CSV, XLSX, OFX, or QIF for now.')
  }
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    throw new Error('Excel files must be read with parseSpreadsheetRows.')
  }
  if (lower.endsWith('.ofx') || text.includes('<OFX')) return parseOfx(text)
  if (lower.endsWith('.qif') || text.trimStart().startsWith('!Type:')) return parseQif(text)
  return parseCsv(text)
}

function parseCsv(text: string): ParsedImport {
  const rows = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(parseCsvLine)
    .filter((row) => row.some((cell) => cell.trim()))

  if (rows.length === 0) throw new Error('No rows found in this CSV.')

  return parseSpreadsheetRows(rows, 'csv')
}

export function parseSpreadsheetRows(rows: string[][], format: Extract<ImportFormat, 'csv' | 'xlsx'>): ParsedImport {
  const cleanedRows = rows
    .map((row) => row.map((cell) => String(cell ?? '').trim()))
    .filter((row) => row.some((cell) => cell.trim()))

  if (cleanedRows.length === 0) throw new Error(`No rows found in this ${format.toUpperCase()} file.`)

  const headerRowIdx = detectHeaderRow(cleanedRows)
  const headers = cleanedRows[headerRowIdx].map((header, idx) => header.trim() || `Column ${idx + 1}`)
  const mapping = autoMapColumns(headers)

  if (!mapping.dateCol || !mapping.descCol || (!mapping.amountCol && (!mapping.debitCol || !mapping.creditCol))) {
    throw new Error(`Could not identify date, description, and amount columns in this ${format.toUpperCase()} file.`)
  }

  return applyMapping(cleanedRows, headers, headerRowIdx, mapping, format)
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        quoted = !quoted
      }
    } else if (ch === ',' && !quoted) {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }

  out.push(cur.trim())
  return out
}

function detectHeaderRow(rows: string[][]): number {
  let best = 0
  let bestIdx = 0
  const scanLimit = Math.min(rows.length, 30)

  for (let i = 0; i < scanLimit; i++) {
    const lower = rows[i].map((cell) => cell.toLowerCase().trim())
    let score = 0
    const all = [...DATE_KW, ...DEBIT_KW, ...CREDIT_KW, ...AMT_KW, ...DESC_KW, ...REF_KW]
    for (const cell of lower) {
      if (all.some((kw) => cell.includes(kw))) score++
      if (SKIP_KW.some((kw) => cell.includes(kw))) score--
    }
    if (score > best) {
      best = score
      bestIdx = i
    }
  }

  return bestIdx
}

function autoMapColumns(headers: string[]): ColumnMapping {
  const lower = headers.map((h) => h.toLowerCase().trim())
  const best = (keywords: string[]): string => {
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
  const amountMode: 'split' | 'single' = debitCol && creditCol ? 'split' : 'single'

  return {
    dateCol,
    descCol,
    refCol,
    amountMode,
    debitCol,
    creditCol,
    amountCol: amountMode === 'single' ? (best(AMT_KW) || debitCol || creditCol) : '',
    positiveIsCredit: false,
  }
}

function applyMapping(
  rows: string[][],
  headers: string[],
  headerRowIdx: number,
  mapping: ColumnMapping,
  format: Extract<ImportFormat, 'csv' | 'xlsx'>,
): ParsedImport {
  const colIdx = (name: string): number => headers.indexOf(name)
  const dateIdx = colIdx(mapping.dateCol)
  const descIdx = colIdx(mapping.descCol)
  const refIdx = colIdx(mapping.refCol)
  const debitIdx = colIdx(mapping.debitCol)
  const creditIdx = colIdx(mapping.creditCol)
  const amountIdx = colIdx(mapping.amountCol)
  const result: ImportRow[] = []
  let skipped = 0

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const get = (idx: number): string => (idx >= 0 ? (row[idx] ?? '') : '')
    const date = parseDate(get(dateIdx))
    if (!date) {
      skipped++
      continue
    }

    const parsedAmount = amountFromRow(get(debitIdx), get(creditIdx), get(amountIdx), mapping)
    if (!parsedAmount) {
      skipped++
      continue
    }

    const description = cleanDescription(get(descIdx) || get(dateIdx + 1) || 'Imported transaction')
    result.push({
      date,
      type: parsedAmount.type,
      amount: parsedAmount.amount,
      description,
      upi_ref: get(refIdx) || null,
    })
  }

  return { format, rows: result, skipped }
}

function amountFromRow(
  debitRaw: string,
  creditRaw: string,
  amountRaw: string,
  mapping: ColumnMapping,
): { type: TransactionType; amount: number } | null {
  if (mapping.amountMode === 'split') {
    const debit = parseAmount(debitRaw)
    const credit = parseAmount(creditRaw)

    if (debit && Math.abs(debit) > 0 && (!credit || Math.abs(credit) === 0)) {
      return { type: 'debit', amount: Math.round(Math.abs(debit) * 100) }
    }
    if (credit && Math.abs(credit) > 0 && (!debit || Math.abs(debit) === 0)) {
      return { type: 'credit', amount: Math.round(Math.abs(credit) * 100) }
    }
    return null
  }

  const amt = parseAmount(amountRaw)
  if (!amt || amt === 0) return null
  if (hasDrSuffix(amountRaw)) return { type: 'debit', amount: Math.round(Math.abs(amt) * 100) }
  if (hasCrSuffix(amountRaw)) return { type: 'credit', amount: Math.round(Math.abs(amt) * 100) }
  if (amt < 0) return { type: mapping.positiveIsCredit ? 'debit' : 'credit', amount: Math.round(Math.abs(amt) * 100) }
  return { type: mapping.positiveIsCredit ? 'credit' : 'debit', amount: Math.round(Math.abs(amt) * 100) }
}

function parseOfx(text: string): ParsedImport {
  const blocks = [...text.matchAll(/<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi)]
  const rows: ImportRow[] = []
  let skipped = 0

  for (const [, block] of blocks) {
    const date = parseOfxDate(readOfxTag(block, 'DTPOSTED'))
    const amount = parseAmount(readOfxTag(block, 'TRNAMT'))
    if (!date || !amount) {
      skipped++
      continue
    }

    rows.push({
      date,
      type: amount < 0 ? 'debit' : 'credit',
      amount: Math.round(Math.abs(amount) * 100),
      description: cleanDescription(readOfxTag(block, 'NAME') || readOfxTag(block, 'MEMO') || 'Imported transaction'),
      upi_ref: readOfxTag(block, 'FITID') || null,
    })
  }

  return { format: 'ofx', rows, skipped }
}

function readOfxTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i'))
  return match?.[1]?.trim() ?? ''
}

function parseOfxDate(raw: string): string | null {
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null
}

function parseQif(text: string): ParsedImport {
  const entries = text.split('^')
  const rows: ImportRow[] = []
  let skipped = 0

  for (const entry of entries) {
    const fields = entry.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    if (fields.length === 0 || fields[0].startsWith('!')) continue

    const date = parseQifDate(readQifField(fields, 'D'))
    const amount = parseAmount(readQifField(fields, 'T'))
    if (!date || !amount) {
      skipped++
      continue
    }

    rows.push({
      date,
      type: amount < 0 ? 'debit' : 'credit',
      amount: Math.round(Math.abs(amount) * 100),
      description: cleanDescription(readQifField(fields, 'P') || readQifField(fields, 'M') || 'Imported transaction'),
      upi_ref: readQifField(fields, 'N') || null,
    })
  }

  return { format: 'qif', rows, skipped }
}

function readQifField(fields: string[], key: string): string {
  return fields.find((line) => line.startsWith(key))?.slice(1).trim() ?? ''
}

function parseQifDate(raw: string): string | null {
  const s = raw.trim().replace(/'/g, '/')
  const match = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (!match) return parseDate(raw)

  const first = Number(match[1])
  const second = Number(match[2])
  const year = match[3].length === 2 ? String(2000 + Number(match[3])) : match[3]

  if (first > 12) return fmt(year, match[2], match[1])
  if (second > 12) return fmt(year, match[1], match[2])
  return fmt(year, match[1], match[2])
}

function parseDate(raw: string): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  const dmy4 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy4) return fmt(dmy4[3], dmy4[2], dmy4[1])

  const dmy2 = s.match(/^(\d{1,2})[\/\-'](\d{1,2})[\/\-'](\d{2})$/)
  if (dmy2) return fmt(String(2000 + Number(dmy2[3])), dmy2[2], dmy2[1])

  const dmy3 = s.match(/^(\d{1,2})[\s\-]([A-Za-z]{3})[\s\-](\d{4})$/)
  if (dmy3) {
    const m = MONTHS[dmy3[2].toLowerCase()]
    if (m) return fmt(dmy3[3], m, dmy3[1])
  }

  const dmy5 = s.match(/^(\d{1,2})\s+([A-Za-z]{3})'(\d{2})$/)
  if (dmy5) {
    const m = MONTHS[dmy5[2].toLowerCase()]
    if (m) return fmt(String(2000 + Number(dmy5[3])), m, dmy5[1])
  }

  return null
}

function fmt(y: string, m: string, d: string): string {
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function cleanDescription(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, 180) || 'Imported transaction'
}

function parseAmount(raw: string): number | null {
  if (!raw) return null
  let s = raw.trim()
  if (!s) return null

  const negative = s.startsWith('(') && s.endsWith(')')
  if (negative) s = s.slice(1, -1).trim()
  s = s.replace(/\s*(Dr|DR|Cr|CR)\.?$/, '').trim()
  s = s.replace(/[₹$€£,\s]/g, '')

  const n = parseFloat(s)
  if (isNaN(n) || n === 0) return null
  return negative ? -Math.abs(n) : n
}

function hasDrSuffix(raw: string): boolean {
  return /\s*(Dr|DR)\.?$/.test(raw.trim())
}

function hasCrSuffix(raw: string): boolean {
  return /\s*(Cr|CR)\.?$/.test(raw.trim())
}
