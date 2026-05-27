import 'server-only'
import type { CategoryRepository } from '../types'
import { sql } from './client'

// Categories are global (shared predefined + custom namespace).
// No user scoping — uses admin connection (bypasses RLS).
// RLS on categories table only protects against anon-key REST access; our server
// is always the writer so superuser access here is intentional.

export class PostgresCategoryRepository implements CategoryRepository {
  async getAll(): Promise<string[]> {
    const rows = await sql`
      SELECT name FROM categories
      ORDER BY is_predefined DESC, name ASC
    `
    return rows.map((r) => r.name as string)
  }

  async getCustom(): Promise<string[]> {
    const rows = await sql`
      SELECT name FROM categories
      WHERE is_predefined = false
      ORDER BY name ASC
    `
    return rows.map((r) => r.name as string)
  }

  async upsertCustom(name: string): Promise<void> {
    await sql`
      INSERT INTO categories (name, is_predefined)
      VALUES (${name}, false)
      ON CONFLICT (name) DO NOTHING
    `
  }

  async deleteCustom(name: string): Promise<void> {
    await sql`
      DELETE FROM categories
      WHERE name = ${name} AND is_predefined = false
    `
  }

  async deleteCustomAndUnlinkTransactions(userId: string, name: string): Promise<void> {
    // Transaction unlink is user-scoped; category delete is global.
    await sql`
      UPDATE transactions
      SET category = NULL, reviewed = false
      WHERE category = ${name} AND user_id = ${userId}
    `
    await sql`
      DELETE FROM categories
      WHERE name = ${name} AND is_predefined = false
    `
  }
}
