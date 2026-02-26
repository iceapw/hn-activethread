CREATE TABLE IF NOT EXISTS raw_events (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID UNIQUE NOT NULL,
    platform VARCHAR(20) NOT NULL,
    content_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(20) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
