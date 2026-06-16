-- Run this on your Supabase project via the SQL editor

-- categories table (FK target for transactions.category)
CREATE TABLE categories (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        TEXT NOT NULL UNIQUE,
  is_predefined BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed predefined categories (must match lib/categories.ts)
INSERT INTO categories (name, is_predefined) VALUES
  ('Food', true),
  ('Transport', true),
  ('Shopping', true),
  ('Entertainment', true),
  ('Health', true),
  ('Utilities', true),
  ('Income', true),
  ('Returns', true),
  ('Investment', true),
  ('Transfer', true),
  ('Other', true);

-- transactions table
CREATE TABLE transactions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  type            TEXT NOT NULL CHECK (type IN ('debit', 'credit', 'transfer')),
  amount          BIGINT NOT NULL,                    -- paise (e.g. ₹120.50 = 12050)
  currency        TEXT NOT NULL DEFAULT 'INR',
  date            DATE NOT NULL,
  time            TIME,
  merchant        TEXT,
  description     TEXT,
  upi_ref         TEXT,
  bank            TEXT,
  category        TEXT REFERENCES categories(name) ON UPDATE CASCADE,
  source          TEXT NOT NULL DEFAULT 'receipt_ocr' CHECK (source IN ('receipt_ocr', 'manual')),
  raw_ai_response TEXT,
  confidence      TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  reviewed        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_reviewed ON transactions(reviewed);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_type ON transactions(type);
