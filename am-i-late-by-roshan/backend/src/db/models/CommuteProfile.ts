import { query, queryOne } from '../connection';

export interface CommuteProfile {
  id: string;
  user_id: string;
  name: string;
  origin: { lat: number; lng: number };
  origin_label: string | null;
  destination: { lat: number; lng: number };
  destination_label: string | null;
  target_arrival_time: string;
  days_of_week: number[];
  active: boolean;
  last_eta_minutes: number | null;
  last_checked_at: Date | null;
  last_alert_at: Date | null;
  last_leave_alert_on: string | null;
  created_at: Date;
}

export interface CommuteProfileInput {
  name?: string;
  origin: { lat: number; lng: number };
  originLabel?: string | null;
  destination: { lat: number; lng: number };
  destinationLabel?: string | null;
  targetArrivalTime: string;
  daysOfWeek?: number[];
  active?: boolean;
}

const SELECT = `
  SELECT id, user_id, name,
         json_build_object('lat', ST_Y(origin::geometry), 'lng', ST_X(origin::geometry)) AS origin,
         origin_label,
         json_build_object('lat', ST_Y(destination::geometry), 'lng', ST_X(destination::geometry)) AS destination,
         destination_label,
         to_char(target_arrival_time, 'HH24:MI') AS target_arrival_time,
         days_of_week, active,
         last_eta_minutes::float AS last_eta_minutes,
         last_checked_at, last_alert_at,
         to_char(last_leave_alert_on, 'YYYY-MM-DD') AS last_leave_alert_on,
         created_at
  FROM commute_profiles`;

export function listCommuteProfiles(userId: string): Promise<CommuteProfile[]> {
  return query<CommuteProfile>(`${SELECT} WHERE user_id = $1 ORDER BY created_at`, [userId]);
}

export function listActiveCommuteProfiles(): Promise<CommuteProfile[]> {
  return query<CommuteProfile>(`${SELECT} WHERE active`);
}

export function getCommuteProfile(userId: string, id: string): Promise<CommuteProfile | null> {
  return queryOne<CommuteProfile>(`${SELECT} WHERE user_id = $1 AND id = $2`, [userId, id]);
}

export async function createCommuteProfile(userId: string, input: CommuteProfileInput): Promise<CommuteProfile> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO commute_profiles
       (user_id, name, origin, origin_label, destination, destination_label, target_arrival_time, days_of_week, active)
     VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5,
             ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography, $8, $9, $10, $11)
     RETURNING id`,
    [
      userId,
      input.name ?? 'Home to Work',
      input.origin.lng,
      input.origin.lat,
      input.originLabel ?? null,
      input.destination.lng,
      input.destination.lat,
      input.destinationLabel ?? null,
      input.targetArrivalTime,
      input.daysOfWeek ?? [1, 2, 3, 4, 5],
      input.active ?? true,
    ],
  );
  return (await getCommuteProfile(userId, row!.id))!;
}

export async function updateCommuteProfile(userId: string, id: string, input: CommuteProfileInput): Promise<CommuteProfile | null> {
  const row = await queryOne<{ id: string }>(
    `UPDATE commute_profiles SET
       name = $3,
       origin = ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, origin_label = $6,
       destination = ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography, destination_label = $9,
       target_arrival_time = $10, days_of_week = $11, active = $12,
       last_eta_minutes = NULL, last_alert_at = NULL
     WHERE user_id = $1 AND id = $2 RETURNING id`,
    [
      userId,
      id,
      input.name ?? 'Home to Work',
      input.origin.lng,
      input.origin.lat,
      input.originLabel ?? null,
      input.destination.lng,
      input.destination.lat,
      input.destinationLabel ?? null,
      input.targetArrivalTime,
      input.daysOfWeek ?? [1, 2, 3, 4, 5],
      input.active ?? true,
    ],
  );
  return row ? getCommuteProfile(userId, id) : null;
}

export async function deleteCommuteProfile(userId: string, id: string): Promise<boolean> {
  const rows = await query('DELETE FROM commute_profiles WHERE user_id = $1 AND id = $2 RETURNING id', [userId, id]);
  return rows.length > 0;
}

export async function recordCommuteCheck(
  id: string,
  etaMinutes: number,
  opts: { alerted?: boolean; leaveAlertOn?: string; at?: Date } = {},
): Promise<void> {
  await query(
    `UPDATE commute_profiles SET
       last_eta_minutes = $2, last_checked_at = $5,
       last_alert_at = CASE WHEN $3 THEN $5 ELSE last_alert_at END,
       last_leave_alert_on = COALESCE($4::date, last_leave_alert_on)
     WHERE id = $1`,
    [id, etaMinutes, opts.alerted ?? false, opts.leaveAlertOn ?? null, opts.at ?? new Date()],
  );
}
