/**
 * Delivers a notification three ways:
 *  1. Stored in the `notifications` inbox (always; the app lists/streams it).
 *  2. Published on the event bus (Redis) so any backend instance holding the
 *     user's live SSE stream forwards it instantly.
 *  3. Firebase Cloud Messaging HTTP v1 to the user's devices (Android + iOS),
 *     when FCM_PROJECT_ID / FCM_CLIENT_EMAIL / FCM_PRIVATE_KEY are set.
 *
 * APNs extension point: iOS is served through FCM (firebase_messaging), which
 * forwards to APNs using the APNs key uploaded in the Firebase console. For a
 * direct APNs integration without Firebase, implement sendApns() below with a
 * token-based (.p8) JWT using APNS_KEY_ID / APNS_TEAM_ID / APNS_PRIVATE_KEY,
 * POSTing to https://api.push.apple.com/3/device/<token> over HTTP/2, and call
 * it for device tokens whose platform is 'ios' and that are raw APNs tokens.
 */
import { JWT } from 'google-auth-library';
import { config } from '../config';
import { deleteDeviceTokenAnyUser, insertNotification, listDeviceTokens, type NotificationRow } from '../db/models/Notification';
import { logger } from '../logger';
import { CHANNELS, getBus } from '../redis/pubsub';

export type NotificationKind = 'EARLY_WARNING' | 'LEAVE_NOW' | 'SPEED' | 'FATIGUE' | 'TRIP' | 'SYSTEM';

export interface OutgoingNotification {
  kind: NotificationKind;
  title: string;
  body: string;
  data?: Record<string, string | number | boolean | null>;
}

export const fcmConfigured = () => Boolean(config.fcm.projectId && config.fcm.clientEmail && config.fcm.privateKey);

let jwtClient: JWT | null = null;
async function fcmAccessToken(): Promise<string> {
  if (!jwtClient) {
    jwtClient = new JWT({
      email: config.fcm.clientEmail,
      key: config.fcm.privateKey,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
  }
  const { token } = await jwtClient.getAccessToken();
  if (!token) throw new Error('Could not obtain FCM access token');
  return token;
}

async function sendFcm(userId: string, n: OutgoingNotification, notificationId: string): Promise<number> {
  const tokens = await listDeviceTokens(userId);
  if (!tokens.length) return 0;
  const accessToken = await fcmAccessToken();
  const data: Record<string, string> = { kind: n.kind, notificationId };
  for (const [k, v] of Object.entries(n.data ?? {})) data[k] = v == null ? '' : String(v);
  let delivered = 0;
  await Promise.all(
    tokens.map(async (t) => {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${config.fcm.projectId}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: t.token,
            notification: { title: n.title, body: n.body },
            data,
            android: { priority: 'HIGH', notification: { channel_id: 'commute_alerts' } },
            apns: { payload: { aps: { sound: 'default' } } },
          },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        delivered++;
      } else if (res.status === 404 || res.status === 400) {
        const text = await res.text();
        if (/UNREGISTERED|INVALID_ARGUMENT|not a valid FCM registration token/i.test(text)) await deleteDeviceTokenAnyUser(t.token);
      } else {
        logger.warn({ status: res.status }, 'FCM send failed');
      }
    }),
  );
  return delivered;
}

export async function sendToUser(userId: string, n: OutgoingNotification): Promise<NotificationRow> {
  const row = await insertNotification(userId, n);
  await getBus().publish(CHANNELS.userNotifications(userId), {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    data: row.data,
    created_at: row.created_at.toISOString(),
  });
  if (fcmConfigured()) {
    try {
      await sendFcm(userId, n, row.id);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'FCM delivery failed');
    }
  }
  return row;
}
