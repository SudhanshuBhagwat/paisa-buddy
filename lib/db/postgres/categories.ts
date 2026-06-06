import 'server-only'
import type { CategoryRepository, CategoryWithColor } from '../types'
import { sql } from './client'

export class PostgresCategoryRepository implements CategoryRepository {
  async getCustomWithColors(userId: string): Promise<CategoryWithColor[]> {
    const rows = await sql`
      SELECT name, COALESCE(color, 'hsl(0, 0%, 54%)') AS color
      FROM categories
      WHERE user_id = ${userId}
      ORDER BY name ASC
    `
    return rows.map((r) => ({ name: r.name as string, color: r.color as string }))
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
