import 'server-only'
import type { UserSettingsRepository, UserSettings } from '../types'
import { withUserContext, sql } from './client'

const DEFAULTS: UserSettings = {
  upiIds: [],
  displayName: null,
  setupCompleted: false,
  uploadToken: null,
  expectedMonthlyIncome: 0,
}

function rowToSettings(row: Record<string, unknown> | undefined): UserSettings {
  if (!row) return { ...DEFAULTS }
  return {
    upiIds: (row.upi_ids as string[]) ?? [],
    displayName: (row.display_name as string | null) ?? null,
    setupCompleted: (row.setup_completed as boolean) ?? false,
    uploadToken: (row.upload_token as string | null) ?? null,
    expectedMonthlyIncome: (row.expected_monthly_income as number) ?? 0,
  }
}

export class PostgresUserSettingsRepository implements UserSettingsRepository {
  async get(userId: string): Promise<UserSettings> {
    return withUserContext(userId, async (db) => {
      const [row] = await db`
        SELECT upi_ids, display_name, setup_completed, upload_token, expected_monthly_income
        FROM user_settings
        WHERE user_id = ${userId}
      `
      return rowToSettings(row)
    })
  }

  async upsert(
    userId: string,
    data: Partial<Pick<UserSettings, 'upiIds' | 'displayName' | 'setupCompleted' | 'uploadToken' | 'expectedMonthlyIncome'>>,
  ): Promise<void> {
    const insertRow: Record<string, unknown> = { user_id: userId }
    const updateRow: Record<string, unknown> = {}

    if (data.upiIds      !== undefined) { insertRow.upi_ids       = updateRow.upi_ids       = data.upiIds }
    if (data.displayName !== undefined) { insertRow.display_name  = updateRow.display_name  = data.displayName }
    if (data.setupCompleted !== undefined) { insertRow.setup_completed = updateRow.setup_completed = data.setupCompleted }
    if (data.uploadToken !== undefined) { insertRow.upload_token  = updateRow.upload_token  = data.uploadToken }
    if (data.expectedMonthlyIncome !== undefined) { insertRow.expected_monthly_income = updateRow.expected_monthly_income = data.expectedMonthlyIncome }

    return withUserContext(userId, async (db) => {
      await db`
        INSERT INTO user_settings ${db(insertRow)}
        ON CONFLICT (user_id)
        DO UPDATE SET ${db(updateRow)}
      `
    })
  }

  async getByUploadToken(
    token: string,
  ): Promise<{ userId: string; displayName: string | null; upiIds: string[] } | null> {
    // Token lookup runs as admin (no user context). RESET ROLE ensures the query
    // runs as postgres (superuser, bypasses RLS) even if the backend connection
    // was left in `authenticated` role by a prior withUserContext call.
    // Both statements share the same backend connection via sql.begin().
    return sql.begin(async (db) => {
      await db`RESET ROLE`
      const [row] = await db`
        SELECT user_id, display_name, upi_ids
        FROM user_settings
        WHERE upload_token = ${token}
      `
      if (!row) return null
      return {
        userId: row.user_id as string,
        displayName: (row.display_name as string | null) ?? null,
        upiIds: (row.upi_ids as string[]) ?? [],
      }
    })
  }
}
