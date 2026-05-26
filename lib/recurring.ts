import type { Transaction } from './types/transaction'

const OCCURRENCE_THRESHOLD = 3
const AMOUNT_TOLERANCE = 0.05
const DAY_TOLERANCE = 5

function normalizeMerchant(merchant: string): string {
  return merchant.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ')
}

function amountsClose(a: number, b: number): boolean {
  if (a === b) return true
  if (a === 0 || b === 0) return false
  return Math.abs(a - b) / ((a + b) / 2) <= AMOUNT_TOLERANCE
}

export type RecurringUpdate = {
  id: string
  is_recurring: true
  recurrence_group: string
}

export function detectRecurringGroups(transactions: Transaction[]): RecurringUpdate[] {
  const updates: RecurringUpdate[] = []
  const updatedIds = new Set<string>()

  const byMerchant = new Map<string, Transaction[]>()
  for (const tx of transactions) {
    if (!tx.reviewed || !tx.merchant) continue
    // Skip transactions the user manually unchecked
    if (!tx.is_recurring && tx.recurrence_group !== null) continue

    const key = normalizeMerchant(tx.merchant)
    if (!byMerchant.has(key)) byMerchant.set(key, [])
    byMerchant.get(key)!.push(tx)
  }

  for (const group of byMerchant.values()) {
    if (group.length < OCCURRENCE_THRESHOLD) continue

    for (const anchor of group) {
      if (updatedIds.has(anchor.id)) continue

      const cluster = group.filter((tx) => {
        if (!amountsClose(anchor.amount, tx.amount)) return false
        const anchorDay = new Date(anchor.date).getDate()
        const txDay = new Date(tx.date).getDate()
        return Math.abs(anchorDay - txDay) <= DAY_TOLERANCE
      })

      if (cluster.length < OCCURRENCE_THRESHOLD) continue

      // Must span at least 2 different months
      const months = new Set(cluster.map((t) => t.date.slice(0, 7)))
      if (months.size < 2) continue

      const existingGroupId = cluster.find((t) => t.recurrence_group)?.recurrence_group
      const groupId = existingGroupId ?? crypto.randomUUID()

      for (const tx of cluster) {
        if (!tx.is_recurring && !updatedIds.has(tx.id)) {
          updates.push({ id: tx.id, is_recurring: true, recurrence_group: groupId })
          updatedIds.add(tx.id)
        }
      }
    }
  }

  return updates
}
