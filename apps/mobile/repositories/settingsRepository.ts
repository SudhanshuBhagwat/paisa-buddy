import { getDb } from '../db/database'

async function getSetting(key: string): Promise<string | null> {
  const db = getDb()
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM user_settings WHERE key = ?',
    [key],
  )
  return row?.value ?? null
}

async function setSetting(key: string, value: string): Promise<void> {
  const db = getDb()
  await db.runAsync(
    'INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)',
    [key, value],
  )
}

async function deleteSetting(key: string): Promise<void> {
  const db = getDb()
  await db.runAsync('DELETE FROM user_settings WHERE key = ?', [key])
}

export type AllSettings = {
  displayName: string | null
  expectedMonthlyIncome: number
  upiIds: string[]
}

export async function getAllSettings(): Promise<AllSettings> {
  const db = getDb()
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM user_settings',
  )
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return {
    displayName: map['display_name'] ?? null,
    expectedMonthlyIncome: map['expected_monthly_income']
      ? parseInt(map['expected_monthly_income'], 10)
      : 0,
    upiIds: map['upi_ids'] ? (JSON.parse(map['upi_ids']) as string[]) : [],
  }
}

export async function setDisplayName(name: string | null): Promise<void> {
  if (name) {
    await setSetting('display_name', name)
  } else {
    await deleteSetting('display_name')
  }
}

export async function setExpectedMonthlyIncome(paise: number): Promise<void> {
  await setSetting('expected_monthly_income', String(paise))
}

export async function addUpiId(id: string): Promise<void> {
  const settings = await getAllSettings()
  if (!settings.upiIds.includes(id)) {
    await setSetting('upi_ids', JSON.stringify([...settings.upiIds, id]))
  }
}

export async function removeUpiId(id: string): Promise<void> {
  const settings = await getAllSettings()
  await setSetting('upi_ids', JSON.stringify(settings.upiIds.filter((u) => u !== id)))
}

export async function clearAllData(): Promise<void> {
  const db = getDb()
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM transactions;
      DELETE FROM accounts;
      DELETE FROM plans;
      DELETE FROM user_settings;
      DELETE FROM import_sessions;
    `)
  })
}
