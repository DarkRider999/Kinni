CREATE TABLE IF NOT EXISTS driver_profiles (
  user_id                      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type                 TEXT NOT NULL DEFAULT 'car',
  has_salik_tag                BOOLEAN NOT NULL DEFAULT TRUE,
  has_darb_account             BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_route_type         TEXT NOT NULL DEFAULT 'FASTEST'
                               CHECK (preferred_route_type IN ('FASTEST', 'CHEAPEST', 'LOW_STRESS')),
  speed_alert_threshold_kmh    INT NOT NULL DEFAULT 5 CHECK (speed_alert_threshold_kmh BETWEEN 0 AND 40),
  fatigue_monitoring_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  max_continuous_drive_minutes INT NOT NULL DEFAULT 120 CHECK (max_continuous_drive_minutes BETWEEN 30 AND 600),
  buffer_minutes               INT NOT NULL DEFAULT 5 CHECK (buffer_minutes BETWEEN 0 AND 60),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);
