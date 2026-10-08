-- DealSpark production schema is applied to Cloudflare D1 database "dealspark".
-- Core tables already exist; this repository keeps the application schema documented here.
-- Authentication extensions added:
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN password_salt TEXT;
ALTER TABLE sessions ADD COLUMN token_hash TEXT;
ALTER TABLE sessions ADD COLUMN workspace_id TEXT;