import { Router } from 'express';
import { z } from 'zod';
import { listCommuteProfiles } from '../db/models/CommuteProfile';
import { getDriverProfile } from '../db/models/DriverProfile';
import { listNotifications } from '../db/models/Notification';
import { getNotificationPreferences } from '../db/models/NotificationPreference';
import { getTripWithRoutes, listTrips } from '../db/models/Trip';
import { deleteUser, findUserById } from '../db/models/User';
import { requireAuth, userIdOf } from '../middleware/auth';
import { notFound } from '../utils/http_error';

export const privacyRouter = Router();
privacyRouter.use(requireAuth);

/** GET /privacy/export - everything stored about the user, as JSON (data portability). */
privacyRouter.get('/export', async (req, res) => {
  const userId = userIdOf(req);
  const user = await findUserById(userId);
  if (!user) throw notFound('User');
  const trips = await listTrips(userId, 1000);
  const [driverProfile, notificationPreferences, commutes, notifications, detailedTrips] = await Promise.all([
    getDriverProfile(userId),
    getNotificationPreferences(userId),
    listCommuteProfiles(userId),
    listNotifications(userId, { limit: 1000 }),
    Promise.all(trips.map((t) => getTripWithRoutes(userId, t.id))),
  ]);
  res.setHeader('Content-Disposition', 'attachment; filename="am-i-late-export.json"');
  res.json({
    exportedAt: new Date().toISOString(),
    user,
    driverProfile,
    notificationPreferences,
    commutes,
    trips: detailedTrips,
    notifications,
    note: 'Traffic speed samples are stored anonymously (no user id) and cannot be linked back to you.',
  });
});

/** DELETE /privacy/account - permanently deletes the user and all their data (cascades). */
privacyRouter.delete('/account', async (req, res) => {
  z.object({ confirm: z.literal('DELETE') }).parse(req.body);
  await deleteUser(userIdOf(req));
  res.status(204).end();
});
