import 'server-only'
import type { CategoryRepository, CategoryWithColor } from '../types'
import { sql } from './client'
import { generateUniqueColor } from '@/lib/categories'

export class PostgresCategoryRepository implements CategoryRepository {
  async getCustomWithColors(userId: string): Promise<CategoryWithColor[]> {
    const rows = await sql`
      SELECT name, COALESCE(color, 'hsl(0, 0%, 54%)') AS color
      FROM categories
      WHERE user_id = ${userId}
      ORDER BY name ASC
    `
    const categories: CategoryWithColor[] = rows.map((r) => ({
      name: r.name as string,
      color: r.color as string,
    }))

    // Auto-repair duplicate colors
    const seen = new Set<string>()
    const allColors = categories.map((c) => c.color)

    for (const cat of categories) {
      if (seen.has(cat.color)) {
        const newColor = generateUniqueColor(allColors)
        allColors.push(newColor)
        cat.color = newColor
        await sql`
          UPDATE categories SET color = ${newColor}
          WHERE user_id = ${userId} AND name = ${cat.name}
        `
      } else {
        seen.add(cat.color)
      }
    }

    return categories
  }

  async upsertCustom(userId: string, name: string, color: string): Promise<void> {
    await sql`
      INSERT INTO categories (user_id, name, color)
      VALUES (${userId}, ${name}, ${color})
      ON CONFLICT (user_id, name) DO NOTHING
    `
  }

  async deleteCustom(userId: string, name: string): Promise<void> {
    await sql`
      DELETE FROM categories
      WHERE user_id = ${userId} AND name = ${name}
    `
  }

  async deleteCustomAndUnlinkTransactions(userId: string, name: string): Promise<void> {
    await sql`
      UPDATE transactions
      SET category = NULL, reviewed = false
      WHERE category = ${name} AND user_id = ${userId}
    `
    await sql`
      DELETE FROM categories
      WHERE user_id = ${userId} AND name = ${name}
    `
  }
}
