CREATE TABLE accounts (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK(type IN ('savings', 'current', 'credit', 'wallet', 'other')),
  bank            TEXT,
  currency        TEXT NOT NULL DEFAULT 'INR',
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
