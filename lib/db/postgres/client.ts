import 'server-only'
import postgres from 'postgres'

// This is the only file that imports 'postgres'.
// All other DB code goes through the repository interfaces in lib/db/types.ts.

if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL')
}

// Admin connection (postgres superuser) — bypasses RLS.
// Used only for: categories writes, getByUploadToken, auth operations.
export const sql = postgres(process.env.DATABASE_URL, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
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
    await db`SET LOCAL ROLE authenticated`
    await db`SELECT set_config('app.user_id', ${userId}, true)`
    return fn(db)
  }) as Promise<T>
}
