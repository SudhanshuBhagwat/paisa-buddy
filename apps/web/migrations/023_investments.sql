-- Named investment instruments (e.g. Zerodha, SBI PPF, HDFC Mutual Fund).
-- Transactions tagged Investments & Savings can optionally link to one of these.
CREATE TABLE IF NOT EXISTS investments (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS investment_id TEXT REFERENCES investments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_investment ON transactions(investment_id);
