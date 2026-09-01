CREATE UNIQUE INDEX IF NOT EXISTS events_single_open_event_idx
ON events ((1))
WHERE status IN ('draft', 'active');