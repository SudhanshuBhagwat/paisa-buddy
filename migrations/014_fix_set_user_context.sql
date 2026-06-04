-- Migration 014: Fix set_user_context to use SET LOCAL ROLE
--
-- Migration 013 used SET ROLE (session-level). After the transaction commits,
-- the connection returns to the pool still running as `authenticated`. Admin
-- queries on reused connections (e.g. getByUploadToken) then run under RLS with
-- no app.user_id set, returning zero rows.
--
-- SET LOCAL ROLE reverts to the original role when the enclosing transaction ends.
-- This matches the two-step approach used before migration 013
-- (SET LOCAL ROLE authenticated + set_config).

CREATE OR REPLACE FUNCTION set_user_context(p_user_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('app.user_id', p_user_id, true);
END;
$$;
