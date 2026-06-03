import 'server-only'
import postgres from 'postgres'

// This is the only file that imports 'postgres'.
// All other DB code goes through the repository interfaces in lib/db/types.ts.

if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL')
}

// Custom type parsers — return date/time as strings to match the Transaction/Account types.
// By default postgres.js returns DATE and TIMESTAMPTZ as JS Date objects.
const types: postgres.Options<{}>['types'] = {
  // DATE (OID 1082) → keep as "YYYY-MM-DD" string
  date: {
    to: 1082,
    from: [1082],
    serialize: (x: string) => x,
    parse: (x: string) => x,
  },
  // TIME (OID 1083) → keep as "HH:MM:SS" string; row mappers slice to "HH:MM"
  time: {
    to: 1083,
    from: [1083],
    serialize: (x: string) => x,
    parse: (x: string) => x,
  },
  // TIMESTAMPTZ (OID 1184) → ISO string
  timestamptz: {
    to: 1184,
    from: [1184],
    serialize: (x: string) => x,
    parse: (x: string) => new Date(x).toISOString(),
  },
}

// Admin connection (postgres superuser) — bypasses RLS.
// Used only for: categories writes, getByUploadToken, auth operations.
export const sql = postgres(process.env.DATABASE_URL, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false, // required for Supabase pooler (PgBouncer transaction mode)
  types,
})

/**
 * Wraps a callback in a transaction that enforces RLS for a specific user.
 *
 * Inside the transaction:
 *   SET LOCAL ROLE authenticated  → switches to the non-superuser role so RLS kicks in
 *   set_config('app.user_id', id) → RLS policies read this via current_setting()
 *
 * All user-owned data operations (transactions, accounts, user_settings) run through this.
 */
export async function withUserContext<T>(
  userId: string,
  fn: (db: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return sql.begin(async (db) => {
    await db`SELECT set_user_context(${userId})`
    return fn(db)
  }) as Promise<T>
}
