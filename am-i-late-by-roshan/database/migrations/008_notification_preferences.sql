CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id                        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  early_warning_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  leave_now_enabled              BOOLEAN NOT NULL DEFAULT TRUE,
  speed_alerts_enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  fatigue_alerts_enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  eta_increase_threshold_minutes INT NOT NULL DEFAULT 10 CHECK (eta_increase_threshold_minutes BETWEEN 1 AND 120),
  quiet_hours_start              TIME,
  quiet_hours_end                TIME,
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);
