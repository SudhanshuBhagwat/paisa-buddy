import { getDb } from '../db/database'
import { generateId } from '../lib/id'
import type { TransactionType } from '@paisa-buddy/shared/types/transaction'

export type LearnedMapping = {
  id: string
  normalized_lookup_key: string
  display_name: string | null
  category_id: string | null
  transaction_type: TransactionType | null
  usage_count: number
  confidence: string
  last_used_at: string | null
  created_at: string
  updated_at: string
}

type LearnedMappingInput = {
  normalizedLookupKey: string
  displayName?: string | null
  categoryId?: string | null
  transactionType?: TransactionType | null
}

export async function getLearnedMapping(normalizedLookupKey: string | null | undefined): Promise<LearnedMapping | null> {
  if (!normalizedLookupKey) return null
  const db = getDb()
  return db.getFirstAsync<LearnedMapping>(
    'SELECT * FROM learned_mappings WHERE normalized_lookup_key = ?',
    [normalizedLookupKey],
  )
}

export async function getLearnedMappings(keys: string[]): Promise<Map<string, LearnedMapping>> {
  const unique = [...new Set(keys.filter(Boolean))]
  const map = new Map<string, LearnedMapping>()
  if (unique.length === 0) return map

  const db = getDb()
  const placeholders = unique.map(() => '?').join(', ')
  const rows = await db.getAllAsync<LearnedMapping>(
    `SELECT * FROM learned_mappings WHERE normalized_lookup_key IN (${placeholders})`,
    unique,
  )
  for (const row of rows) map.set(row.normalized_lookup_key, row)
  return map
}

export async function saveLearnedMapping(input: LearnedMappingInput): Promise<void> {
  const key = input.normalizedLookupKey?.trim()
  if (!key) return

  const db = getDb()
  const now = new Date().toISOString()
  const existing = await getLearnedMapping(key)
  if (existing) {
    await db.runAsync(
      `UPDATE learned_mappings
       SET display_name = COALESCE(?, display_name),
           category_id = COALESCE(?, category_id),
           transaction_type = COALESCE(?, transaction_type),
           usage_count = usage_count + 1,
           confidence = 'user_confirmed',
           last_used_at = ?,
           updated_at = ?
       WHERE normalized_lookup_key = ?`,
      [
        input.displayName?.trim() || null,
        input.categoryId ?? null,
        input.transactionType ?? null,
        now,
        now,
        key,
      ],
    )
    return
  }

  await db.runAsync(
    `INSERT INTO learned_mappings
      (id, normalized_lookup_key, display_name, category_id, transaction_type,
       usage_count, confidence, last_used_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, 'user_confirmed', ?, ?, ?)`,
    [
      generateId(),
      key,
      input.displayName?.trim() || null,
      input.categoryId ?? null,
      input.transactionType ?? null,
      now,
      now,
      now,
    ],
  )
}
