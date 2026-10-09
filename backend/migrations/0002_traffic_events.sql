CREATE TABLE IF NOT EXISTS traffic_events (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL CHECK (event IN ('page_view','demo_click','lead_click')),
  session_id TEXT NOT NULL,
  page TEXT NOT NULL,
  referrer TEXT NOT NULL DEFAULT '',
  target TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_traffic_events_created ON traffic_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_events_session ON traffic_events(session_id);
CREATE INDEX IF NOT EXISTS idx_traffic_events_event ON traffic_events(event);
