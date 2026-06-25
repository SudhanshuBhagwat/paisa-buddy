import { getDb } from '../db/database'

const BACKUP_APP = 'paisa-buddy'
const BACKUP_SCHEMA_VERSION = 1

type BackupPayload = {
  app: typeof BACKUP_APP
  schemaVersion: typeof BACKUP_SCHEMA_VERSION
  createdAt: string
  data: Record<string, unknown[]>
}

const TABLES = [
  'user_settings',
  'accounts',
  'categories',
  'transactions',
  'plans',
  'learned_mappings',
  'import_sessions',
  'review_sessions',
] as const

export async function generateBackupJson(): Promise<string> {
  const db = getDb()
  const data: Record<string, unknown[]> = {}

  for (const table of TABLES) {
    data[table] = await db.getAllAsync(`SELECT * FROM ${table}`)
  }

  const payload: BackupPayload = {
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    data,
  }

  return JSON.stringify(payload, null, 2)
}

export function validateBackupJson(raw: string): BackupPayload {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('This backup file is not valid JSON.')
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('This backup file is invalid.')
  }

  const payload = parsed as Partial<BackupPayload>
  if (payload.app !== BACKUP_APP) {
    throw new Error('This is not a Paisa Buddy backup.')
  }
  if (payload.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error('This backup version is not supported by this app.')
  }
  if (!payload.data || typeof payload.data !== 'object') {
    throw new Error('This backup is missing its data section.')
  }

  for (const table of TABLES) {
    if (!Array.isArray(payload.data[table])) {
      throw new Error(`This backup is missing ${table}.`)
    }
  }

  return payload as BackupPayload
}

export async function restoreBackupJson(raw: string): Promise<void> {
  const backup = validateBackupJson(raw)
  const db = getDb()

  await db.withTransactionAsync(async () => {
    for (const table of [...TABLES].reverse()) {
      await db.runAsync(`DELETE FROM ${table}`)
    }

    for (const table of TABLES) {
      for (const row of backup.data[table]) {
        if (!row || typeof row !== 'object') {
          throw new Error(`Invalid row in ${table}.`)
        }
        const record = row as Record<string, unknown>
        const columns = Object.keys(record)
        if (columns.length === 0) continue
        const placeholders = columns.map(() => '?').join(', ')
        const values = columns.map((column) => normalizeSqlValue(record[column]))
        await db.runAsync(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          values,
        )
      }
    }
  })
}

function normalizeSqlValue(value: unknown): string | number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  return JSON.stringify(value)
}
