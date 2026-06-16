-- Migration 013: set_user_context helper function
--
-- Combines SET ROLE + set_config into a single round-trip.
-- Previously withUserContext made two sequential SQL calls:
--   SET LOCAL ROLE authenticated
--   SELECT set_config('app.user_id', $1, true)
-- Now it calls this function once, saving one network RTT per query.

CREATE OR REPLACE FUNCTION set_user_context(p_user_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  SET ROLE authenticated;
  PERFORM set_config('app.user_id', p_user_id, true);
END;
$$;

GRANT EXECUTE ON FUNCTION set_user_context(TEXT) TO postgres, authenticated;
