CREATE INDEX IF NOT EXISTS idx_raw_events_created_at ON raw_events (created_at);
CREATE INDEX IF NOT EXISTS idx_raw_events_event_type ON raw_events (event_type);
CREATE INDEX IF NOT EXISTS idx_raw_events_content_id ON raw_events (content_id);
CREATE INDEX IF NOT EXISTS idx_raw_events_type_created ON raw_events (event_type, created_at);
