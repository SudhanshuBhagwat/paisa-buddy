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
  email: string | null
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
    email: map['email'] ?? null,
    expectedMonthlyIncome: map['expected_monthly_income']
      ? parseInt(map['expected_monthly_income'], 10)
      : 0,
    upiIds: map['upi_ids'] ? (JSON.parse(map['upi_ids']) as string[]) : [],
  }
}

export async function setEmail(email: string | null): Promise<void> {
  if (email) {
    await setSetting('email', email)
  } else {
    await deleteSetting('email')
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

const DEFAULT_CATEGORIES: Array<{ name: string; color: string }> = [
  { name: 'Food', color: '#1A936F' },
  { name: 'Transport', color: '#2E8B9E' },
  { name: 'Shopping', color: '#C25FA0' },
  { name: 'Entertainment', color: '#C77D3A' },
  { name: 'Health', color: '#C65D5D' },
  { name: 'Utilities', color: '#6B8E3D' },
  { name: 'Income', color: '#157F4C' },
  { name: 'Returns', color: '#7B5EA7' },
  { name: 'Investment', color: '#C99A2E' },
  { name: 'Transfer', color: '#3B82C4' },
  { name: 'Other', color: '#7E8A82' },
]

export async function clearAllData(): Promise<void> {
  const db = getDb()
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM review_sessions;
      DELETE FROM learned_mappings;
      DELETE FROM transactions;
      DELETE FROM accounts;
      DELETE FROM plans;
      DELETE FROM user_settings;
      DELETE FROM import_sessions;
      DELETE FROM categories;
    `)
    for (const cat of DEFAULT_CATEGORIES) {
      await db.runAsync(
        'INSERT INTO categories (name, color, is_custom) VALUES (?, ?, 0)',
        [cat.name, cat.color],
      )
    }
  })
}

export async function isSetupComplete(): Promise<boolean> {
  const val = await getSetting('setup_completed')
  return val === '1'
}

export async function markSetupComplete(): Promise<void> {
  await setSetting('setup_completed', '1')
}
