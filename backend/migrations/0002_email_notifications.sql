CREATE TABLE IF NOT EXISTS email_connections (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL CHECK (provider IN ('google','microsoft')),
  account_email TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT DEFAULT '',
  expires_at TEXT DEFAULT '',
  scopes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'connected',
  last_error TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  lead_id TEXT,
  channel TEXT NOT NULL,
  recipient TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT DEFAULT '',
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_business_created
  ON notification_deliveries(business_id, created_at DESC);
