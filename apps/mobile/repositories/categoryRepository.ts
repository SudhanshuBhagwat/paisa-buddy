import { getDb } from '../db/database'
import { CATEGORY_COLORS, PREDEFINED_CATEGORIES, generateUniqueColor } from '@paisa-buddy/shared/categories'

export type CategoryRow = {
  name: string
  color: string
  icon: string | null
  is_custom: number
  transaction_count: number
}

export type CategoryWithCount = {
  name: string
  color: string
  icon: string | null
  is_custom: boolean
  transactionCount: number
}

export async function listCategories(): Promise<CategoryWithCount[]> {
  const db = getDb()
  const rows = await db.getAllAsync<CategoryRow>(`
    SELECT c.name, c.color, c.icon, c.is_custom,
      COUNT(t.id) AS transaction_count
    FROM categories c
    LEFT JOIN transactions t ON t.category = c.name
    GROUP BY c.name
    ORDER BY c.is_custom ASC, c.name ASC
  `)
  return rows.map((r) => ({
    name: r.name,
    color: r.color,
    icon: r.icon ?? null,
    is_custom: r.is_custom === 1,
    transactionCount: r.transaction_count,
  }))
}

export async function getCategoryColors(): Promise<Record<string, string>> {
  const db = getDb()
  const rows = await db.getAllAsync<{ name: string; color: string }>(
    'SELECT name, color FROM categories',
  )
  return Object.fromEntries(rows.map((r) => [r.name, r.color]))
}

export async function createCategory(name: string): Promise<{ name: string; color: string }> {
  const db = getDb()
  const existingHsl = await db.getAllAsync<{ color: string }>(
    "SELECT color FROM categories WHERE color LIKE 'hsl%'",
  )
  const color = generateUniqueColor(existingHsl.map((r) => r.color))
  await db.runAsync(
    'INSERT OR IGNORE INTO categories (name, color, is_custom) VALUES (?, ?, 1)',
    [name, color],
  )
  // Return existing color if category already existed
  const existing = await db.getFirstAsync<{ color: string }>(
    'SELECT color FROM categories WHERE name = ?',
    [name],
  )
  return { name, color: existing?.color ?? color }
}

export async function ensureDefaultCategories(): Promise<void> {
  const db = getDb()
  for (const name of PREDEFINED_CATEGORIES) {
    await db.runAsync(
      'INSERT OR IGNORE INTO categories (name, color, is_custom) VALUES (?, ?, 0)',
      [name, CATEGORY_COLORS[name]],
    )
  }
}

export async function updateCategoryIcon(name: string, icon: string | null): Promise<void> {
  const db = getDb()
  await db.runAsync('UPDATE categories SET icon = ? WHERE name = ?', [icon, name])
}

export async function deleteCategory(name: string, unlink: boolean): Promise<void> {
  const db = getDb()
  await db.withTransactionAsync(async () => {
    if (unlink) {
      await db.runAsync('UPDATE transactions SET category = NULL WHERE category = ?', [name])
    }
    await db.runAsync('DELETE FROM categories WHERE name = ?', [name])
  })
}
