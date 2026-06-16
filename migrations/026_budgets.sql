CREATE TABLE IF NOT EXISTS budgets (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category   TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  period     TEXT NOT NULL DEFAULT 'monthly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY budgets_owner ON budgets
  FOR ALL
  USING      (user_id = current_setting('app.user_id', true))
  WITH CHECK (user_id = current_setting('app.user_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON budgets TO authenticated;
