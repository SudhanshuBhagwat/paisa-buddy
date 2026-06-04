-- Migration 015: Add upload_token column to user_settings
--
-- This column was referenced in code but never added via migration.
-- IF NOT EXISTS makes it safe to run on databases where it was added manually.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS upload_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS user_settings_upload_token_idx
  ON user_settings(upload_token)
  WHERE upload_token IS NOT NULL;
