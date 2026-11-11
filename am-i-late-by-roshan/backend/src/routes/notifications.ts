import { Router } from 'express';
import { z } from 'zod';
import { listNotifications, markAllNotificationsRead, markNotificationRead, upsertDeviceToken, deleteDeviceToken } from '../db/models/Notification';
import { getNotificationPreferences, updateNotificationPreferences } from '../db/models/NotificationPreference';
import { requireAuth, userIdOf } from '../middleware/auth';
import { CHANNELS, getBus } from '../redis/pubsub';
import { fcmConfigured } from '../services/push_notification_service';
import { notFound } from '../utils/http_error';
import { hhmm, uuid } from './schemas';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/preferences', async (req, res) => {
  res.json({ preferences: await getNotificationPreferences(userIdOf(req)), pushConfigured: fcmConfigured() });
});

notificationsRouter.put('/preferences', async (req, res) => {
  const body = z
    .object({
      early_warning_enabled: z.boolean().optional(),
      leave_now_enabled: z.boolean().optional(),
      speed_alerts_enabled: z.boolean().optional(),
      fatigue_alerts_enabled: z.boolean().optional(),
      eta_increase_threshold_minutes: z.number().int().min(1).max(120).optional(),
      quiet_hours_start: hhmm.nullable().optional(),
      quiet_hours_end: hhmm.nullable().optional(),
    })
    .strict()
    .parse(req.body);
  res.json({ preferences: await updateNotificationPreferences(userIdOf(req), body) });
});

notificationsRouter.post('/devices', async (req, res) => {
  const body = z.object({ token: z.string().min(10).max(4096), platform: z.enum(['android', 'ios', 'web']) }).parse(req.body);
  await upsertDeviceToken(userIdOf(req), body.token, body.platform);
  res.status(201).json({ registered: true });
});

notificationsRouter.delete('/devices', async (req, res) => {
  const body = z.object({ token: z.string().min(10).max(4096) }).parse(req.body);
  await deleteDeviceToken(userIdOf(req), body.token);
  res.json({ removed: true });
});

/** GET /notifications?unread=true&limit=50 - the in-app inbox. */
notificationsRouter.get('/', async (req, res) => {
  const q = z
    .object({ unread: z.enum(['true', 'false']).optional(), limit: z.coerce.number().int().min(1).max(200).default(50) })
    .parse(req.query);
  res.json({ notifications: await listNotifications(userIdOf(req), { unreadOnly: q.unread === 'true', limit: q.limit }) });
});

notificationsRouter.post('/read-all', async (req, res) => {
  res.json({ updated: await markAllNotificationsRead(userIdOf(req)) });
});

notificationsRouter.post('/:id/read', async (req, res) => {
  const ok = await markNotificationRead(userIdOf(req), uuid.parse(req.params.id));
  if (!ok) throw notFound('Unread notification');
  res.json({ read: true });
});

/**
 * GET /notifications/stream - Server-Sent Events. Each notification for the
 * user is pushed as `event: notification`. Works across instances via Redis.
 */
notificationsRouter.get('/stream', (req, res) => {
  const userId = userIdOf(req);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': connected\n\n');
  const unsubscribe = getBus().subscribe(CHANNELS.userNotifications(userId), (msg) => {
    res.write(`event: notification\ndata: ${JSON.stringify(msg)}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});
