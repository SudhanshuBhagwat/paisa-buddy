-- Migration 012: Switch RLS policies to standard PostgreSQL current_setting()
--
-- Replaces Supabase-specific auth.uid() with current_setting('app.user_id', true).
-- The postgres.js adapter sets this via SET LOCAL inside each user-scoped transaction,
-- then SET LOCAL ROLE authenticated so RLS is enforced.
--
-- Works on any PostgreSQL provider (Neon, RDS, Railway, Supabase, etc.).

-- ── Drop Supabase-specific policies ─────────────────────────────────────────

DROP POLICY IF EXISTS transactions_owner  ON transactions;
DROP POLICY IF EXISTS accounts_owner      ON accounts;
DROP POLICY IF EXISTS user_settings_owner ON user_settings;
DROP POLICY IF EXISTS users_own_row       ON users;

-- ── New portable policies ────────────────────────────────────────────────────

CREATE POLICY transactions_owner ON transactions
  FOR ALL
  USING      (user_id = current_setting('app.user_id', true))
  WITH CHECK (user_id = current_setting('app.user_id', true));

CREATE POLICY accounts_owner ON accounts
  FOR ALL
  USING      (user_id = current_setting('app.user_id', true))
  WITH CHECK (user_id = current_setting('app.user_id', true));

CREATE POLICY user_settings_owner ON user_settings
  FOR ALL
  USING      (user_id = current_setting('app.user_id', true))
  WITH CHECK (user_id = current_setting('app.user_id', true));

CREATE POLICY users_own_row ON users
  FOR ALL
  USING      (id = current_setting('app.user_id', true))
  WITH CHECK (id = current_setting('app.user_id', true));

-- ── Grant authenticated role table access ────────────────────────────────────
-- Required for SET LOCAL ROLE authenticated to work in user-scoped transactions.

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON transactions  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON accounts      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_settings TO authenticated;
GRANT SELECT                         ON users         TO authenticated;
GRANT SELECT                         ON categories    TO authenticated;

-- ── Fix user_settings unique constraint ─────────────────────────────────────
-- Migration 009 created a partial unique index (WHERE user_id IS NOT NULL).
-- ON CONFLICT (user_id) in upserts requires a full unique constraint.

DROP INDEX IF EXISTS user_settings_user_id_key;
ALTER TABLE user_settings
  ADD CONSTRAINT user_settings_user_id_unique UNIQUE (user_id);
