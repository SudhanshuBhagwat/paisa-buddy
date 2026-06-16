-- Add attempt counter to otp_tokens to prevent brute-force guessing.
-- Tokens are locked and deleted after 5 failed attempts.
ALTER TABLE otp_tokens ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
