-- Migration 017: Trigger to maintain accounts.current_balance
--
-- Replaces application-level balance updates (which required an extra getById
-- round-trip + separate updateBalance round-trip per action).
-- The trigger fires atomically within the same transaction as the transaction
-- INSERT/UPDATE/DELETE, so no extra network RTTs from the app.
--
-- SECURITY DEFINER: runs as postgres (superuser) to bypass RLS on accounts,
-- since the trigger must update accounts regardless of the calling role.

CREATE OR REPLACE FUNCTION trg_maintain_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Reverse OLD balance effect (UPDATE or DELETE of a reviewed transaction)
  IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') AND OLD.reviewed = true THEN
    IF OLD.account_id IS NOT NULL THEN
      UPDATE accounts SET current_balance = current_balance +
        CASE OLD.type
          WHEN 'credit'             THEN -OLD.amount   -- reverse: had added, now subtract
          WHEN 'debit'              THEN  OLD.amount   -- reverse: had subtracted, now add
          WHEN 'transfer'           THEN  OLD.amount   -- reverse: had subtracted, now add
        END
      WHERE id = OLD.account_id;
    END IF;
    IF OLD.to_account_id IS NOT NULL AND OLD.type = 'transfer' THEN
      UPDATE accounts SET current_balance = current_balance - OLD.amount
      WHERE id = OLD.to_account_id;
    END IF;
  END IF;

  -- Apply NEW balance effect (INSERT or UPDATE resulting in a reviewed transaction)
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.reviewed = true THEN
    IF NEW.account_id IS NOT NULL THEN
      UPDATE accounts SET current_balance = current_balance +
        CASE NEW.type
          WHEN 'credit'             THEN  NEW.amount
          WHEN 'debit'              THEN -NEW.amount
          WHEN 'transfer'           THEN -NEW.amount
        END
      WHERE id = NEW.account_id;
    END IF;
    IF NEW.to_account_id IS NOT NULL AND NEW.type = 'transfer' THEN
      UPDATE accounts SET current_balance = current_balance + NEW.amount
      WHERE id = NEW.to_account_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_account_balance
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION trg_maintain_account_balance();
