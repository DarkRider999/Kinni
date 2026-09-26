import { queryOne } from '../connection';

export type RouteType = 'FASTEST' | 'CHEAPEST' | 'LOW_STRESS';

export interface DriverProfile {
  user_id: string;
  vehicle_type: string;
  has_salik_tag: boolean;
  has_darb_account: boolean;
  preferred_route_type: RouteType;
  speed_alert_threshold_kmh: number;
  fatigue_monitoring_enabled: boolean;
  max_continuous_drive_minutes: number;
  buffer_minutes: number;
  updated_at: Date;
}

export type DriverProfileUpdate = Partial<Omit<DriverProfile, 'user_id' | 'updated_at'>>;

const EDITABLE: (keyof DriverProfileUpdate)[] = [
  'vehicle_type',
  'has_salik_tag',
  'has_darb_account',
  'preferred_route_type',
  'speed_alert_threshold_kmh',
  'fatigue_monitoring_enabled',
  'max_continuous_drive_minutes',
  'buffer_minutes',
];

/** Returns the profile, creating a default one on first access. */
export async function getDriverProfile(userId: string): Promise<DriverProfile> {
  const row = await queryOne<DriverProfile>(
    `INSERT INTO driver_profiles (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING *`,
    [userId],
  );
  return row!;
}

export async function updateDriverProfile(userId: string, update: DriverProfileUpdate): Promise<DriverProfile> {
  await getDriverProfile(userId);
  const fields = EDITABLE.filter((k) => update[k] !== undefined);
  if (fields.length === 0) return getDriverProfile(userId);
  const sets = fields.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const row = await queryOne<DriverProfile>(
    `UPDATE driver_profiles SET ${sets}, updated_at = now() WHERE user_id = $1 RETURNING *`,
    [userId, ...fields.map((k) => update[k])],
  );
  return row!;
}
