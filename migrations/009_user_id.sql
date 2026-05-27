-- Migration 009: User-scoped data isolation
-- Adds user_id to transactions, accounts, and user_settings.
-- Primary isolation: app-level filtering in repository layer (portable to any DB).
-- Optional secondary: RLS policies using standard PostgreSQL current_setting()
--   (NOT Supabase auth.uid() — works on Neon, RDS, Railway, etc.)

-- 1. transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);

-- 2. accounts
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);

-- 3. user_settings: break singleton (was id='default') → one row per user keyed by user_id
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS user_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS user_settings_user_id_key
  ON user_settings(user_id) WHERE user_id IS NOT NULL;

-- ============================================================
-- REQUIRED: backfill existing data with your login email.
-- Run these manually after applying the migration:
--
--   UPDATE transactions   SET user_id = 'your@email.com';
--   UPDATE accounts       SET user_id = 'your@email.com';
--   UPDATE user_settings  SET user_id = 'your@email.com' WHERE id = 'default';
-- ============================================================

-- Optional: RLS as a secondary safety net.
-- Uses standard PostgreSQL current_setting() — not Supabase-specific.
-- Uncomment AFTER completing the backfill above.
--
-- ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE accounts     ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY transactions_user_isolation ON transactions
--   USING (user_id = current_setting('app.user_id', true));
--
-- CREATE POLICY accounts_user_isolation ON accounts
--   USING (user_id = current_setting('app.user_id', true));
--
-- Note: service_role key bypasses RLS by design.
-- Primary isolation is always the app-level user_id filter in the repository layer.
