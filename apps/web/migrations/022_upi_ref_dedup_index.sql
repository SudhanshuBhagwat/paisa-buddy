-- Prevent duplicate transactions with the same UPI reference per user+account.
-- Partial: only rows where upi_ref is not null and not empty.
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_upi_ref_dedup
  ON transactions (user_id, account_id, upi_ref)
  WHERE upi_ref IS NOT NULL AND upi_ref <> '';
