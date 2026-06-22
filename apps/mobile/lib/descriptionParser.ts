export type PaymentRail = 'UPI' | 'NEFT' | 'IMPS' | 'CARD' | 'ATM' | 'UNKNOWN'
export type ParsedDirection = 'DEBIT' | 'CREDIT' | 'UNKNOWN'

export type ParsedDescription = {
  rawDescription: string
  cleanedDescription: string
  paymentRail: PaymentRail
  direction: ParsedDirection
  referenceNumber?: string
  parsedDisplayName?: string
  bankCode?: string
  vpaOrAccount?: string
  mode?: string
  normalizedLookupKey: string
  dedupeKey: string
  parserVersion: string
}

const PARSER_VERSION = 'description-parser-v1'

export function parseTransactionDescription(raw: string): ParsedDescription {
  const rawDescription = String(raw ?? '')
  const cleanedDescription = cleanDescription(rawDescription)
  const upi = parseUpi(cleanedDescription)
  const paymentRail = upi ? 'UPI' : detectRail(cleanedDescription)
  const direction = upi?.direction ?? detectDirection(cleanedDescription)
  const parsedDisplayName = upi?.parsedDisplayName ?? fallbackDisplayName(cleanedDescription, paymentRail)
  const bankCode = upi?.bankCode
  const vpaOrAccount = upi?.vpaOrAccount
  const referenceNumber = upi?.referenceNumber ?? extractReference(cleanedDescription)
  const mode = upi?.mode
  const normalizedLookupKey = buildLookupKey({
    paymentRail,
    direction,
    parsedDisplayName,
    bankCode,
    vpaOrAccount,
    cleanedDescription,
  })

  return {
    rawDescription,
    cleanedDescription,
    paymentRail,
    direction,
    referenceNumber,
    parsedDisplayName,
    bankCode,
    vpaOrAccount,
    mode,
    normalizedLookupKey,
    dedupeKey: referenceNumber
      ? `${normalizedLookupKey}|ref|${normalizeToken(referenceNumber)}`
      : normalizedLookupKey,
    parserVersion: PARSER_VERSION,
  }
}

export function buildTransactionDedupeKey(args: {
  accountId: string | null | undefined
  date: string
  amount: number
  direction: ParsedDirection | string
  normalizedLookupKey: string
  referenceNumber?: string | null
}): string {
  const direction = normalizeDirection(args.direction)
  const prefix = [
    normalizeToken(args.accountId || 'unknown-account'),
    args.date,
    String(args.amount),
    direction.toLowerCase(),
  ]
  const ref = normalizeToken(args.referenceNumber || '')
  return ref
    ? [...prefix, ref].join('|')
    : [...prefix, args.normalizedLookupKey].join('|')
}

export function normalizeLookupPart(raw: string | null | undefined): string {
  return normalizeToken(raw ?? '')
}

function parseUpi(cleaned: string): {
  direction: ParsedDirection
  referenceNumber?: string
  parsedDisplayName?: string
  bankCode?: string
  vpaOrAccount?: string
  mode?: string
} | null {
  const match = cleaned.match(/\bUPI\/([^/\s]+)\/([^/\s]+)\/([^/]+)\/([^/]+)\/([^/\s]+)(?:\/([^/\s]+))?/i)
  if (!match) return null

  return {
    direction: directionFromToken(match[1]),
    referenceNumber: match[2]?.trim(),
    parsedDisplayName: normalizeDisplayName(match[3]),
    bankCode: match[4]?.trim(),
    vpaOrAccount: match[5]?.trim(),
    mode: match[6]?.trim(),
  }
}

function buildLookupKey(args: {
  paymentRail: PaymentRail
  direction: ParsedDirection
  parsedDisplayName?: string
  bankCode?: string
  vpaOrAccount?: string
  cleanedDescription: string
}): string {
  const displayName = args.parsedDisplayName || args.cleanedDescription
  const parts = [
    args.paymentRail.toLowerCase(),
    args.direction.toLowerCase(),
    normalizeToken(displayName),
    normalizeToken(args.bankCode ?? ''),
    normalizeToken(args.vpaOrAccount ?? ''),
  ].filter(Boolean)

  return parts.join('|') || normalizeToken(args.cleanedDescription) || 'unknown'
}

function cleanDescription(raw: string): string {
  return raw
    .replace(/\r?\n+/g, ' ')
    .replace(/[|]+/g, '/')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\r?\n+/g, ' ')
    .replace(/[|]+/g, ' ')
    .replace(/[^\p{L}\p{N}@._\-\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeDisplayName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

function detectRail(cleaned: string): PaymentRail {
  if (/\bNEFT\b/i.test(cleaned)) return 'NEFT'
  if (/\bIMPS\b/i.test(cleaned)) return 'IMPS'
  if (/\b(?:CARD|POS|VISA|MASTERCARD)\b/i.test(cleaned)) return 'CARD'
  if (/\bATM\b/i.test(cleaned)) return 'ATM'
  return 'UNKNOWN'
}

function detectDirection(cleaned: string): ParsedDirection {
  if (/\b(?:DR|DEBIT|WDL|WITHDRAWAL|PAID)\b/i.test(cleaned)) return 'DEBIT'
  if (/\b(?:CR|CREDIT|SAL|SALARY|RECEIVED)\b/i.test(cleaned)) return 'CREDIT'
  return 'UNKNOWN'
}

function directionFromToken(raw: string): ParsedDirection {
  if (/^(DR|DEBIT)$/i.test(raw)) return 'DEBIT'
  if (/^(CR|CREDIT)$/i.test(raw)) return 'CREDIT'
  return 'UNKNOWN'
}

function normalizeDirection(raw: ParsedDirection | string): ParsedDirection {
  if (/^(debit|expense|dr)$/i.test(raw)) return 'DEBIT'
  if (/^(credit|income|cr)$/i.test(raw)) return 'CREDIT'
  return directionFromToken(raw)
}

function extractReference(cleaned: string): string | undefined {
  const labelled = cleaned.match(/\b(?:UPI|UTR|RRN|REF|REFERENCE|TXN|TRANSACTION)[\s:/#-]*([A-Z0-9]{8,})\b/i)
  if (labelled?.[1]) return labelled[1]
  return undefined
}

function fallbackDisplayName(cleaned: string, rail: PaymentRail): string | undefined {
  let value = cleaned
  if (rail !== 'UNKNOWN') {
    value = value.replace(new RegExp(`\\b${rail}\\b`, 'i'), ' ')
  }
  value = value
    .replace(/\b(?:WDL|TFR|DR|CR|DEBIT|CREDIT|TRANSFER|PAYMENT|PAID|TO|FROM)\b/gi, ' ')
    .replace(/\b\d{8,}\b/g, ' ')
    .replace(/[/_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return value || undefined
}
