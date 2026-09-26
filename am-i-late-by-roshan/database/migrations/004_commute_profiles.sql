-- Recurring commutes watched by the Smart Commute Early-Warning cron job.
CREATE TABLE IF NOT EXISTS commute_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL DEFAULT 'Home to Work',
  origin               GEOGRAPHY(Point, 4326) NOT NULL,
  origin_label         TEXT,
  destination          GEOGRAPHY(Point, 4326) NOT NULL,
  destination_label    TEXT,
  target_arrival_time  TIME NOT NULL,
  -- ISO weekdays, 1 = Monday ... 7 = Sunday (UAE weekend is Sat/Sun).
  days_of_week         SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5}',
  active               BOOLEAN NOT NULL DEFAULT TRUE,
  last_eta_minutes     NUMERIC,
  last_checked_at      TIMESTAMPTZ,
  last_alert_at        TIMESTAMPTZ,
  last_leave_alert_on  DATE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS commute_profiles_user_idx ON commute_profiles (user_id);
CREATE INDEX IF NOT EXISTS commute_profiles_active_idx ON commute_profiles (active) WHERE active;
