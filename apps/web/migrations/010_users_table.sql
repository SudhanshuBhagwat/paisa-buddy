-- Migration 010: Proper users table with UUID primary key
-- Replaces email-as-user_id with an opaque UUID.
-- user_id columns remain TEXT (stores UUID string) — no schema type change needed.

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed from the emails already in user_settings (set by migration 009).
INSERT INTO users (email)
  SELECT DISTINCT user_id FROM user_settings WHERE user_id IS NOT NULL
  ON CONFLICT (email) DO NOTHING;

-- Backfill user_id UUID into all three tables using a JOIN on the old email value.
UPDATE transactions
  SET user_id = u.id
  FROM users u
  WHERE transactions.user_id = u.email;

UPDATE accounts
  SET user_id = u.id
  FROM users u
  WHERE accounts.user_id = u.email;

UPDATE user_settings
  SET user_id = u.id
  FROM users u
  WHERE user_settings.user_id = u.email;

-- After this migration:
-- • All user_id values in transactions/accounts/user_settings are UUIDs.
-- • Existing login sessions still hold the old JWT (id = email).
--   A sign-out + sign-in is required to get a UUID-bearing JWT.
