import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getDriverProfile } from '../db/models/DriverProfile';
import { getNotificationPreferences } from '../db/models/NotificationPreference';
import { optionalAuth, requireAuth, userIdOf } from '../middleware/auth';
import { sendToUser } from '../services/push_notification_service';
import { crowdSpeedNear, getSpeedLimit, getTrafficForecast, recordSnapshot } from '../services/traffic_service';
import { isoDate, latLngQuery } from './schemas';

export const trafficRouter = Router();

/** GET /traffic/forecast?lat&lng[&destLat&destLng][&at=ISO] */
trafficRouter.get('/forecast', optionalAuth, async (req, res) => {
  const q = latLngQuery
    .extend({
      destLat: z.coerce.number().min(-90).max(90).optional(),
      destLng: z.coerce.number().min(-180).max(180).optional(),
      at: isoDate.optional(),
    })
    .parse(req.query);
  const origin = { lat: q.lat, lng: q.lng };
  const dest = q.destLat != null && q.destLng != null ? { lat: q.destLat, lng: q.destLng } : origin;
  res.json(await getTrafficForecast(origin, dest, q.at ?? new Date()));
});

/** GET /traffic/speed-limit?lat&lng[&road=name] */
trafficRouter.get('/speed-limit', optionalAuth, async (req, res) => {
  const q = latLngQuery.extend({ road: z.string().max(120).optional() }).parse(req.query);
  res.json(await getSpeedLimit({ lat: q.lat, lng: q.lng }, q.road));
});

trafficRouter.get('/crowd', optionalAuth, async (req, res) => {
  const q = latLngQuery.parse(req.query);
  res.json({ crowd: await crowdSpeedNear({ lat: q.lat, lng: q.lng }) });
});

const reportLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });

/**
 * POST /traffic/report - anonymous speed sample from a navigating app.
 * If the driver is speeding past their threshold, a SPEED alert is sent too.
 */
trafficRouter.post('/report', requireAuth, reportLimiter, async (req, res) => {
  const body = z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      speedKmh: z.number().min(0).max(300),
      speedLimitKmh: z.number().min(0).max(200).nullish(),
      heading: z.number().min(0).max(360).nullish(),
    })
    .parse(req.body);
  await recordSnapshot(body);
  let speeding = false;
  if (body.speedLimitKmh) {
    const userId = userIdOf(req);
    const [profile, prefs] = await Promise.all([getDriverProfile(userId), getNotificationPreferences(userId)]);
    speeding = body.speedKmh > body.speedLimitKmh + profile.speed_alert_threshold_kmh;
    if (speeding && prefs.speed_alerts_enabled) {
      await sendToUser(userId, {
        kind: 'SPEED',
        title: 'Slow down',
        body: `You're doing ${Math.round(body.speedKmh)} km/h in a ${body.speedLimitKmh} km/h zone.`,
        data: { speedKmh: Math.round(body.speedKmh), speedLimitKmh: body.speedLimitKmh },
      });
    }
  }
  res.status(201).json({ recorded: true, speeding });
});
