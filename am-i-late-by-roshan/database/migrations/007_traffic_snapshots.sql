-- Anonymous, crowd-sourced speed samples (no user_id on purpose). These are the
-- training data for replacing the heuristic AI models later.
CREATE TABLE IF NOT EXISTS traffic_snapshots (
  id              BIGSERIAL PRIMARY KEY,
  location        GEOGRAPHY(Point, 4326) NOT NULL,
  speed_kmh       NUMERIC NOT NULL CHECK (speed_kmh >= 0 AND speed_kmh <= 300),
  speed_limit_kmh NUMERIC,
  heading         NUMERIC,
  source          TEXT NOT NULL DEFAULT 'crowd',
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS traffic_snapshots_location_idx ON traffic_snapshots USING GIST (location);
CREATE INDEX IF NOT EXISTS traffic_snapshots_captured_idx ON traffic_snapshots (captured_at DESC);
