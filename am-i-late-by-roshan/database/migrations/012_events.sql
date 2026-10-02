-- Venues and scheduled events that cause local congestion. The backend also
-- merges events from EVENTS_API_URL (any JSON feed) when configured.
CREATE TABLE IF NOT EXISTS venues (
  id        SERIAL PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE,
  emirate   TEXT NOT NULL,
  location  GEOGRAPHY(Point, 4326) NOT NULL,
  capacity  INT NOT NULL DEFAULT 5000
);
CREATE INDEX IF NOT EXISTS venues_location_idx ON venues USING GIST (location);

CREATE TABLE IF NOT EXISTS events (
  id                  SERIAL PRIMARY KEY,
  venue_id            INT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  starts_at           TIMESTAMPTZ NOT NULL,
  ends_at             TIMESTAMPTZ NOT NULL,
  expected_attendance INT NOT NULL DEFAULT 5000,
  source              TEXT NOT NULL DEFAULT 'manual',
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS events_time_idx ON events (starts_at, ends_at);

INSERT INTO venues (name, emirate, location, capacity) VALUES
  ('Dubai World Trade Centre', 'Dubai',     ST_SetSRID(ST_MakePoint(55.2870, 25.2250), 4326)::geography, 30000),
  ('Coca-Cola Arena',          'Dubai',     ST_SetSRID(ST_MakePoint(55.2610, 25.2062), 4326)::geography, 17000),
  ('Dubai Opera',              'Dubai',     ST_SetSRID(ST_MakePoint(55.2723, 25.1957), 4326)::geography, 2000),
  ('Expo City Dubai',          'Dubai',     ST_SetSRID(ST_MakePoint(55.1510, 24.9640), 4326)::geography, 60000),
  ('Etihad Arena',             'Abu Dhabi', ST_SetSRID(ST_MakePoint(54.6040, 24.4690), 4326)::geography, 18000),
  ('Yas Marina Circuit',       'Abu Dhabi', ST_SetSRID(ST_MakePoint(54.6031, 24.4672), 4326)::geography, 60000),
  ('Zayed Sports City',        'Abu Dhabi', ST_SetSRID(ST_MakePoint(54.4520, 24.4150), 4326)::geography, 45000),
  ('Sharjah Cricket Stadium',  'Sharjah',   ST_SetSRID(ST_MakePoint(55.4040, 25.3330), 4326)::geography, 27000)
ON CONFLICT (name) DO NOTHING;
