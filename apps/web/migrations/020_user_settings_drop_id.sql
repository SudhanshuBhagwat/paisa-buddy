-- Migration 020: Collapse user_settings to a single `id` primary key
-- The original singleton used id='default'. Migration 009 added user_id as the
-- real identifier. Drop the vestigial id column and rename user_id → id.

ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_pkey;
ALTER TABLE user_settings DROP COLUMN IF EXISTS id;

ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_user_id_unique;
ALTER TABLE user_settings ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE user_settings RENAME COLUMN user_id TO id;
ALTER TABLE user_settings ADD PRIMARY KEY (id);

-- Update RLS policy to use renamed column
DROP POLICY IF EXISTS user_settings_owner ON user_settings;
CREATE POLICY user_settings_owner ON user_settings
  FOR ALL
  USING      (id = current_setting('app.user_id', true))
  WITH CHECK (id = current_setting('app.user_id', true));
