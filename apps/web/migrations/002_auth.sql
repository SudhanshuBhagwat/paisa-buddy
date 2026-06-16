-- Run this on your Supabase project after 001_initial.sql

CREATE TABLE otp_tokens (
  email      TEXT NOT NULL PRIMARY KEY,   -- one active OTP per email
  token      TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
