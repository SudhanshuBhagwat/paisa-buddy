ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS expected_monthly_income INTEGER NOT NULL DEFAULT 0;
