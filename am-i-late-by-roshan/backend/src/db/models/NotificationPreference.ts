import { queryOne } from '../connection';

export interface NotificationPreference {
  user_id: string;
  early_warning_enabled: boolean;
  leave_now_enabled: boolean;
  speed_alerts_enabled: boolean;
  fatigue_alerts_enabled: boolean;
  eta_increase_threshold_minutes: number;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  updated_at: Date;
}

export type NotificationPreferenceUpdate = Partial<Omit<NotificationPreference, 'user_id' | 'updated_at'>>;

const EDITABLE: (keyof NotificationPreferenceUpdate)[] = [
  'early_warning_enabled',
  'leave_now_enabled',
  'speed_alerts_enabled',
  'fatigue_alerts_enabled',
  'eta_increase_threshold_minutes',
  'quiet_hours_start',
  'quiet_hours_end',
];

export async function getNotificationPreferences(userId: string): Promise<NotificationPreference> {
  const row = await queryOne<NotificationPreference>(
    `INSERT INTO notification_preferences (user_id, eta_increase_threshold_minutes) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING *`,
    [userId, Number(process.env.EARLY_WARNING_ETA_INCREASE_MINUTES ?? 10)],
  );
  return row!;
}

export async function updateNotificationPreferences(
  userId: string,
  update: NotificationPreferenceUpdate,
): Promise<NotificationPreference> {
  await getNotificationPreferences(userId);
  const fields = EDITABLE.filter((k) => update[k] !== undefined);
  if (fields.length === 0) return getNotificationPreferences(userId);
  const sets = fields.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const row = await queryOne<NotificationPreference>(
    `UPDATE notification_preferences SET ${sets}, updated_at = now() WHERE user_id = $1 RETURNING *`,
    [userId, ...fields.map((k) => update[k])],
  );
  return row!;
}

/** True when the UAE-local minute-of-day falls inside the user's quiet hours (handles overnight ranges). */
export function isInQuietHours(prefs: Pick<NotificationPreference, 'quiet_hours_start' | 'quiet_hours_end'>, minutesOfDay: number): boolean {
  if (!prefs.quiet_hours_start || !prefs.quiet_hours_end) return false;
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const start = toMin(prefs.quiet_hours_start);
  const end = toMin(prefs.quiet_hours_end);
  if (start === end) return false;
  return start < end ? minutesOfDay >= start && minutesOfDay < end : minutesOfDay >= start || minutesOfDay < end;
}
