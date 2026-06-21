import type { SQLiteDatabase } from 'expo-sqlite'

async function migration001InitialSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'savings',
      bank TEXT,
      opening_balance INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      name TEXT PRIMARY KEY,
      color TEXT NOT NULL,
      is_custom INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      date TEXT NOT NULL,
      time TEXT,
      merchant TEXT,
      description TEXT,
      category TEXT,
      account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      to_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      reviewed INTEGER NOT NULL DEFAULT 1,
      source TEXT NOT NULL DEFAULT 'manual',
      upi_ref TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_reviewed ON transactions(reviewed);

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      month TEXT NOT NULL,
      amount INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(category, month)
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_sessions (
      id TEXT PRIMARY KEY,
      filename TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
}

async function migration002SeedCategories(db: SQLiteDatabase): Promise<void> {
  const categories: Array<{ name: string; color: string }> = [
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
    { name: 'Settlement', color: '#9B6B9E' },
    { name: 'Other', color: '#7E8A82' },
  ]

  for (const cat of categories) {
    await db.runAsync(
      'INSERT OR IGNORE INTO categories (name, color, is_custom) VALUES (?, ?, 0)',
      [cat.name, cat.color],
    )
  }
}

async function migration003FixPlansTable(db: SQLiteDatabase): Promise<void> {
  // Remove month column — plans are per-category (not per-month).
  // Month is used only when calculating spent amounts at query time.
  await db.execAsync(`
    CREATE TABLE plans_new (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL UNIQUE,
      amount INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO plans_new SELECT id, category, amount, created_at FROM plans;
    DROP TABLE plans;
    ALTER TABLE plans_new RENAME TO plans;
  `)
}

const MIGRATIONS = [
  { version: 1, up: migration001InitialSchema },
  { version: 2, up: migration002SeedCategories },
  { version: 3, up: migration003FixPlansTable },
]

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const applied = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version',
  )
  const done = new Set(applied.map((r) => r.version))

  for (const m of MIGRATIONS) {
    if (!done.has(m.version)) {
      await db.withTransactionAsync(async () => {
        await m.up(db)
        await db.runAsync('INSERT INTO schema_migrations (version) VALUES (?)', [m.version])
      })
    }
  }
}
