DELETE FROM categories
WHERE name IN (
  'Food', 'Transport', 'Shopping', 'Entertainment', 'Health',
  'Utilities', 'Income', 'Returns', 'Investment', 'Transfer',
  'Settlement', 'Other'
);
