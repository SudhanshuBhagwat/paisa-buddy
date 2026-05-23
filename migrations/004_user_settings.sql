CREATE TABLE user_settings (
  id       TEXT PRIMARY KEY DEFAULT 'default',
  upi_ids  TEXT[] NOT NULL DEFAULT '{}'
);

-- Seed the single row so upserts always update rather than insert
INSERT INTO user_settings (id) VALUES ('default') ON CONFLICT DO NOTHING;
