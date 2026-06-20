import type { Transaction } from '@paisa-buddy/shared/types/transaction'

export type TxGroup = {
  key: string
  displayName: string
  transactions: Transaction[]
  suggestion: string | null
}

export type GroupingResult = {
  groups: TxGroup[]
  singles: Transaction[]
}

const STOP_WORDS = new Set([
  'payment',
  'paid',
  'pay',
  'upi',
  'imps',
  'neft',
  'rtgs',
  'pos',
  'txn',
  'transaction',
  'transfer',
  'to',
  'from',
  'the',
  'pvt',
  'ltd',
  'limited',
])

export function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokensFor(raw: string): string[] {
  return normalize(raw)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token) && !/^\d+$/.test(token))
}

function keyFor(raw: string): string {
  const tokens = tokensFor(raw)
  return tokens.join(' ') || normalize(raw)
}

function tokenSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const aSet = new Set(a)
  const bSet = new Set(b)
  let overlap = 0

  for (const token of aSet) {
    if (bSet.has(token)) overlap += 1
  }

  const smaller = Math.min(aSet.size, bSet.size)
  return smaller > 0 ? overlap / smaller : 0
}

function isSimilarMerchant(a: string, b: string): boolean {
  const aKey = keyFor(a)
  const bKey = keyFor(b)

  if (!aKey || !bKey) return false
  if (aKey === bKey) return true
  if (aKey.length >= 5 && bKey.length >= 5 && (aKey.includes(bKey) || bKey.includes(aKey))) {
    return true
  }

  return tokenSimilarity(tokensFor(aKey), tokensFor(bKey)) >= 0.75
}

export function groupTransactions(txs: Transaction[]): GroupingResult {
  const buckets: Array<{ key: string; displayName: string; transactions: Transaction[] }> = []
  const noKey: Transaction[] = []

  for (const tx of txs) {
    const raw = (tx.merchant || tx.description || '').trim()
    if (!raw) {
      noKey.push(tx)
      continue
    }

    const key = keyFor(raw)
    if (!key) {
      noKey.push(tx)
      continue
    }

    const bucket = buckets.find((candidate) => isSimilarMerchant(candidate.key, key))
    if (bucket) {
      bucket.transactions.push(tx)
    } else {
      buckets.push({
        key,
        displayName: tx.merchant || tx.description || key,
        transactions: [tx],
      })
    }
  }

  const groups: TxGroup[] = []
  const singles: Transaction[] = [...noKey]

  for (const bucket of buckets) {
    if (bucket.transactions.length >= 2) {
      groups.push({
        key: bucket.key,
        displayName: bucket.displayName,
        transactions: bucket.transactions,
        suggestion: null,
      })
    } else {
      singles.push(...bucket.transactions)
    }
  }

  groups.sort((a, b) => b.transactions.length - a.transactions.length)
  return { groups, singles }
}
