-- Enable RLS on investments table, matching the pattern from 012_rls_postgres_adapter.sql

ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY investments_owner ON investments
  FOR ALL
  USING      (user_id = current_setting('app.user_id', true))
  WITH CHECK (user_id = current_setting('app.user_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON investments TO authenticated;
