ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_source_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_source_check
  CHECK (source IN ('receipt_ocr', 'manual', 'bank_import'));
