CREATE TABLE IF NOT EXISTS trips (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  origin                GEOGRAPHY(Point, 4326) NOT NULL,
  origin_label          TEXT,
  destination           GEOGRAPHY(Point, 4326) NOT NULL,
  destination_label     TEXT,
  target_arrival        TIMESTAMPTZ,
  recommended_departure TIMESTAMPTZ,
  expected_arrival      TIMESTAMPTZ,
  verdict               TEXT CHECK (verdict IN ('ON_TIME', 'LEAVE_NOW', 'LATE', 'NO_TARGET')),
  minutes_late          NUMERIC,
  selected_route_type   TEXT CHECK (selected_route_type IN ('FASTEST', 'CHEAPEST', 'LOW_STRESS')),
  status                TEXT NOT NULL DEFAULT 'PLANNED'
                        CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  explanation           TEXT,
  provider              TEXT,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trips_user_created_idx ON trips (user_id, created_at DESC);
