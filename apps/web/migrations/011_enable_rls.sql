-- Migration 011: Enable Row Level Security
--
-- What this protects:
--   Direct REST/anon-key access to Supabase is blocked for all user data.
--   Only service_role (our server) can read/write — RLS is bypassed for service_role.
--
-- What this does NOT change:
--   App behaviour is identical. All server-side queries use service_role which
--   bypasses RLS, so no code changes are needed.
--
-- auth.uid() reads the `sub` claim from the request JWT.
-- Our user UUIDs (users.id) are the values stored in all user_id columns,
-- so when we later mint user-scoped JWTs (sub = users.id), the policies
-- will enforce per-user isolation in-app as well.

-- ── User-owned tables ────────────────────────────────────────────────────────

ALTER TABLE transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Each user can only see and modify their own rows.
-- user_id is TEXT; auth.uid() returns UUID — cast to match.
CREATE POLICY transactions_owner  ON transactions  FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY accounts_owner      ON accounts      FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY user_settings_owner ON user_settings FOR ALL USING (user_id = auth.uid()::text);

-- ── Users table ──────────────────────────────────────────────────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Each user can only see their own row.
CREATE POLICY users_own_row ON users FOR ALL USING (id = auth.uid()::text);

-- ── Auth table (otp_tokens) ──────────────────────────────────────────────────

ALTER TABLE otp_tokens ENABLE ROW LEVEL SECURITY;
-- No policies — anon/authenticated roles cannot access OTP tokens at all.
-- Only service_role (our server) touches this table.

-- ── Categories (global shared lookup) ───────────────────────────────────────

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read categories (they are shared predefined values).
-- Only service_role can write (insert/update/delete) — no write policy needed.
CREATE POLICY categories_read ON categories FOR SELECT USING (true);
