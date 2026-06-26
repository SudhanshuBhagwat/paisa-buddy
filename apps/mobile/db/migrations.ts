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
    { name: 'Family', color: '#D16B86' },
    { name: 'Income', color: '#157F4C' },
    { name: 'Returns', color: '#7B5EA7' },
    { name: 'Rent', color: '#8B6F47' },
    { name: 'Investment', color: '#C99A2E' },
    { name: 'Subscriptions', color: '#7C6ED6' },
    { name: 'Transfer', color: '#3B82C4' },
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

async function migration004IndexesAndBankColumn(db: SQLiteDatabase): Promise<void> {
  // Indexes present in web schema but missing from initial SQLite migration
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_transactions_type       ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_transactions_to_account ON transactions(to_account_id);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_upi_ref_dedup
      ON transactions (account_id, upi_ref)
      WHERE upi_ref IS NOT NULL AND upi_ref <> '';
  `)

  // bank column exists in web transactions table — needed for review form payload
  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(transactions)')
  if (!cols.some((c) => c.name === 'bank')) {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN bank TEXT')
  }
}

async function migration005ImportIntelligence(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DROP INDEX IF EXISTS idx_transactions_upi_ref_dedup')

  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(transactions)')
  const existing = new Set(cols.map((c) => c.name))
  const addColumn = async (name: string, sql: string) => {
    if (!existing.has(name)) {
      await db.execAsync(`ALTER TABLE transactions ADD COLUMN ${name} ${sql}`)
    }
  }

  await addColumn('raw_description', 'TEXT')
  await addColumn('parsed_display_name', 'TEXT')
  await addColumn('user_display_name', 'TEXT')
  await addColumn('normalized_lookup_key', 'TEXT')
  await addColumn('parser_version', 'TEXT')
  await addColumn('category_source', 'TEXT')
  await addColumn('dedupe_key', 'TEXT')
  await addColumn('import_session_id', 'TEXT')
  await addColumn('duplicate_status', "TEXT DEFAULT 'none'")
  await addColumn('duplicate_of_transaction_id', 'TEXT')

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS learned_mappings (
      id TEXT PRIMARY KEY,
      normalized_lookup_key TEXT NOT NULL UNIQUE,
      display_name TEXT,
      category_id TEXT,
      transaction_type TEXT,
      usage_count INTEGER DEFAULT 1,
      confidence TEXT DEFAULT 'user_confirmed',
      last_used_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(name)
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_lookup_key ON transactions(normalized_lookup_key);
    CREATE INDEX IF NOT EXISTS idx_transactions_dedupe_key ON transactions(dedupe_key);
    CREATE INDEX IF NOT EXISTS idx_transactions_import_session ON transactions(import_session_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_duplicate_status ON transactions(duplicate_status);
    CREATE INDEX IF NOT EXISTS idx_learned_mappings_lookup_key ON learned_mappings(normalized_lookup_key);
  `)
}

async function migration006ImportReviewSessions(db: SQLiteDatabase): Promise<void> {
  const importCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(import_sessions)')
  const existingImportCols = new Set(importCols.map((c) => c.name))
  const addImportColumn = async (name: string, sql: string) => {
    if (!existingImportCols.has(name)) {
      await db.execAsync(`ALTER TABLE import_sessions ADD COLUMN ${name} ${sql}`)
    }
  }

  await addImportColumn('file_name', 'TEXT')
  await addImportColumn('file_hash', 'TEXT')
  await addImportColumn('transaction_count', 'INTEGER NOT NULL DEFAULT 0')
  await addImportColumn('statement_start_date', 'TEXT')
  await addImportColumn('statement_end_date', 'TEXT')
  await addImportColumn('updated_at', 'TEXT')

  await db.execAsync(`
    UPDATE import_sessions
    SET file_name = COALESCE(file_name, filename),
        updated_at = COALESCE(updated_at, created_at)
    WHERE file_name IS NULL OR updated_at IS NULL;

    CREATE TABLE IF NOT EXISTS review_sessions (
      id TEXT PRIMARY KEY,
      import_session_id TEXT,
      current_group_id TEXT,
      current_item_id TEXT,
      review_progress INTEGER NOT NULL DEFAULT 0,
      total_count INTEGER NOT NULL DEFAULT 0,
      review_status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (import_session_id) REFERENCES import_sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_import_sessions_file_hash ON import_sessions(file_hash);
    CREATE INDEX IF NOT EXISTS idx_review_sessions_status ON review_sessions(review_status);
    CREATE INDEX IF NOT EXISTS idx_review_sessions_import_session ON review_sessions(import_session_id);
  `)
}

async function migration007DefaultLaunchCategories(db: SQLiteDatabase): Promise<void> {
  const categories: Array<{ name: string; color: string }> = [
    { name: 'Family', color: '#D16B86' },
    { name: 'Rent', color: '#8B6F47' },
    { name: 'Subscriptions', color: '#7C6ED6' },
  ]

  for (const cat of categories) {
    await db.runAsync(
      'INSERT OR IGNORE INTO categories (name, color, is_custom) VALUES (?, ?, 0)',
      [cat.name, cat.color],
    )
  }
}

async function migration008CategoryIconColumn(db: SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(categories)')
  if (!cols.some((c) => c.name === 'icon')) {
    await db.execAsync('ALTER TABLE categories ADD COLUMN icon TEXT')
  }
}

async function migration009FinanceQueryIndexes(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_transactions_category
      ON transactions(category);

    CREATE INDEX IF NOT EXISTS idx_transactions_type_date
      ON transactions(type, date);

    CREATE INDEX IF NOT EXISTS idx_transactions_category_type_date
      ON transactions(category, type, date);

    CREATE INDEX IF NOT EXISTS idx_transactions_reviewed_date
      ON transactions(reviewed, date);

    CREATE INDEX IF NOT EXISTS idx_transactions_account_reviewed
      ON transactions(account_id, reviewed);

    CREATE INDEX IF NOT EXISTS idx_transactions_to_account_reviewed
      ON transactions(to_account_id, reviewed);
  `)
}

const MIGRATIONS = [
  { version: 1, up: migration001InitialSchema },
  { version: 2, up: migration002SeedCategories },
  { version: 3, up: migration003FixPlansTable },
  { version: 4, up: migration004IndexesAndBankColumn },
  { version: 5, up: migration005ImportIntelligence },
  { version: 6, up: migration006ImportReviewSessions },
  { version: 7, up: migration007DefaultLaunchCategories },
  { version: 8, up: migration008CategoryIconColumn },
  { version: 9, up: migration009FinanceQueryIndexes },
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
