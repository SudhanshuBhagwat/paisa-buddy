INSERT INTO categories (name, is_predefined)
VALUES ('Settlement', true)
ON CONFLICT (name) DO UPDATE SET is_predefined = true;
