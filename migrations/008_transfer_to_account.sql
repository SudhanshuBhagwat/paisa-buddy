ALTER TABLE transactions ADD COLUMN IF NOT EXISTS to_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_to_account ON transactions(to_account_id);
