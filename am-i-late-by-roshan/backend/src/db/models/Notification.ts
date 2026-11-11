import { query, queryOne } from '../connection';

export interface NotificationRow {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: Date | null;
  created_at: Date;
}

export async function insertNotification(
  userId: string,
  n: { kind: string; title: string; body: string; data?: Record<string, unknown> },
): Promise<NotificationRow> {
  const row = await queryOne<NotificationRow>(
    'INSERT INTO notifications (user_id, kind, title, body, data) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [userId, n.kind, n.title, n.body, JSON.stringify(n.data ?? {})],
  );
  return row!;
}

export function listNotifications(userId: string, opts: { unreadOnly?: boolean; limit?: number } = {}): Promise<NotificationRow[]> {
  return query<NotificationRow>(
    `SELECT * FROM notifications WHERE user_id = $1 AND ($2::boolean IS FALSE OR read_at IS NULL)
     ORDER BY created_at DESC LIMIT $3`,
    [userId, opts.unreadOnly ?? false, opts.limit ?? 50],
  );
}

export async function markNotificationRead(userId: string, id: string): Promise<boolean> {
  const rows = await query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND id = $2 AND read_at IS NULL RETURNING id', [userId, id]);
  return rows.length > 0;
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const rows = await query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL RETURNING id', [userId]);
  return rows.length;
}

export interface DeviceToken {
  token: string;
  user_id: string;
  platform: 'android' | 'ios' | 'web';
}

export async function upsertDeviceToken(userId: string, token: string, platform: DeviceToken['platform']): Promise<void> {
  await query(
    `INSERT INTO device_tokens (token, user_id, platform) VALUES ($1, $2, $3)
     ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, last_seen_at = now()`,
    [token, userId, platform],
  );
}

export async function deleteDeviceToken(userId: string, token: string): Promise<void> {
  await query('DELETE FROM device_tokens WHERE user_id = $1 AND token = $2', [userId, token]);
}

export async function deleteDeviceTokenAnyUser(token: string): Promise<void> {
  await query('DELETE FROM device_tokens WHERE token = $1', [token]);
}

export function listDeviceTokens(userId: string): Promise<DeviceToken[]> {
  return query<DeviceToken>('SELECT token, user_id, platform FROM device_tokens WHERE user_id = $1', [userId]);
}
