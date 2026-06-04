-- Migration 016: Add current_balance to accounts
--
-- Stores a running balance so pages can query account totals without
-- loading all transactions. Maintained by the application on every
-- confirmed (reviewed=true) transaction insert/update/delete.

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS current_balance NUMERIC NOT NULL DEFAULT 0;

-- Backfill: same logic as calcAccountBalance in lib/utils.ts
-- Only reviewed transactions, only those dated after the account was created.
UPDATE accounts a
SET current_balance = a.opening_balance + COALESCE((
  SELECT SUM(
    CASE
      WHEN t.account_id    = a.id AND t.type = 'credit'              THEN  t.amount
      WHEN t.account_id    = a.id AND t.type IN ('debit','transfer')  THEN -t.amount
      WHEN t.to_account_id = a.id AND t.type = 'transfer'            THEN  t.amount
      ELSE 0
    END
  )
  FROM transactions t
  WHERE t.user_id  = a.user_id
    AND t.reviewed = true
    AND t.date     > (a.created_at AT TIME ZONE 'UTC')::DATE
    AND (t.account_id = a.id OR t.to_account_id = a.id)
), 0);
