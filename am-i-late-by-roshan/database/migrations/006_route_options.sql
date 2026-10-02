CREATE TABLE IF NOT EXISTS route_options (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id              UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  route_type           TEXT NOT NULL CHECK (route_type IN ('FASTEST', 'CHEAPEST', 'LOW_STRESS')),
  variant_key          TEXT NOT NULL,
  summary              TEXT,
  distance_km          NUMERIC NOT NULL,
  duration_minutes     NUMERIC NOT NULL,
  duration_p10_minutes NUMERIC,
  duration_p90_minutes NUMERIC,
  eta_confidence       NUMERIC,
  toll_cost_aed        NUMERIC NOT NULL DEFAULT 0,
  toll_gates           JSONB NOT NULL DEFAULT '[]',
  stress_score         NUMERIC,
  congestion_level     TEXT,
  school_zones         JSONB NOT NULL DEFAULT '[]',
  path                 GEOGRAPHY(LineString, 4326),
  polyline             TEXT,
  steps                JSONB NOT NULL DEFAULT '[]',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, route_type)
);
CREATE INDEX IF NOT EXISTS route_options_trip_idx ON route_options (trip_id);
