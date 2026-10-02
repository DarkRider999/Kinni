import { Router } from 'express';
import { z } from 'zod';
import { createCommuteProfile, deleteCommuteProfile, getCommuteProfile, listCommuteProfiles, updateCommuteProfile } from '../db/models/CommuteProfile';
import { getDriverProfile, updateDriverProfile } from '../db/models/DriverProfile';
import { getNotificationPreferences } from '../db/models/NotificationPreference';
import { requireAuth, userIdOf } from '../middleware/auth';
import { getAiClient } from '../services/ai_client';
import { sendToUser } from '../services/push_notification_service';
import { checkCommute } from '../services/notification_scheduler';
import { uaeLocal } from '../utils/geo';
import { notFound } from '../utils/http_error';
import { hhmm, latLng, routeType, uuid } from './schemas';

export const driverProfileRouter = Router();
driverProfileRouter.use(requireAuth);

driverProfileRouter.get('/', async (req, res) => {
  res.json({ profile: await getDriverProfile(userIdOf(req)) });
});

driverProfileRouter.put('/', async (req, res) => {
  const body = z
    .object({
      vehicle_type: z.enum(['car', 'suv', 'motorbike', 'van', 'taxi', 'truck']).optional(),
      has_salik_tag: z.boolean().optional(),
      has_darb_account: z.boolean().optional(),
      preferred_route_type: routeType.optional(),
      speed_alert_threshold_kmh: z.number().int().min(0).max(40).optional(),
      fatigue_monitoring_enabled: z.boolean().optional(),
      max_continuous_drive_minutes: z.number().int().min(30).max(600).optional(),
      buffer_minutes: z.number().int().min(0).max(60).optional(),
    })
    .strict()
    .parse(req.body);
  res.json({ profile: await updateDriverProfile(userIdOf(req), body) });
});

/**
 * POST /driver-profile/fatigue-check - scores driver state from on-device
 * sensor aggregates; sends a FATIGUE alert when the model says so.
 */
driverProfileRouter.post('/fatigue-check', async (req, res) => {
  const userId = userIdOf(req);
  const body = z
    .object({
      continuousDriveMinutes: z.number().min(0).max(1440),
      steeringVariance: z.number().min(0).max(10).default(0),
      harshEventCount: z.number().int().min(0).max(1000).default(0),
      speedVariance: z.number().min(0).max(10_000).default(0),
      hoursSlept: z.number().min(0).max(24).nullish(),
    })
    .parse(req.body);
  const [profile, prefs] = await Promise.all([getDriverProfile(userId), getNotificationPreferences(userId)]);
  const state = await getAiClient().scoreDriverState({
    continuous_drive_minutes: body.continuousDriveMinutes,
    local_hour: uaeLocal(new Date()).hour,
    steering_variance: body.steeringVariance,
    harsh_event_count: body.harshEventCount,
    speed_variance: body.speedVariance,
    hours_slept: body.hoursSlept ?? null,
  });
  const overLimit = body.continuousDriveMinutes >= profile.max_continuous_drive_minutes;
  const shouldAlert = profile.fatigue_monitoring_enabled && (state.should_alert || overLimit);
  if (shouldAlert && prefs.fatigue_alerts_enabled) {
    await sendToUser(userId, {
      kind: 'FATIGUE',
      title: overLimit && !state.should_alert ? 'Time for a break' : 'Fatigue warning',
      body: overLimit && !state.should_alert ? `You've been driving for ${Math.round(body.continuousDriveMinutes)} min. Take a short break.` : state.recommendation,
      data: { fatigueScore: state.fatigue_score, level: state.level },
    });
  }
  res.json({ ...state, should_alert: shouldAlert, over_drive_limit: overLimit });
});

// ------------------------------------------------------------------ commute profiles

const commuteBody = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  origin: latLng,
  originLabel: z.string().max(200).nullish(),
  destination: latLng,
  destinationLabel: z.string().max(200).nullish(),
  targetArrivalTime: hhmm,
  daysOfWeek: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
  active: z.boolean().optional(),
});

driverProfileRouter.get('/commutes', async (req, res) => {
  res.json({ commutes: await listCommuteProfiles(userIdOf(req)) });
});

driverProfileRouter.post('/commutes', async (req, res) => {
  res.status(201).json({ commute: await createCommuteProfile(userIdOf(req), commuteBody.parse(req.body)) });
});

driverProfileRouter.put('/commutes/:id', async (req, res) => {
  const commute = await updateCommuteProfile(userIdOf(req), uuid.parse(req.params.id), commuteBody.parse(req.body));
  if (!commute) throw notFound('Commute');
  res.json({ commute });
});

driverProfileRouter.delete('/commutes/:id', async (req, res) => {
  if (!(await deleteCommuteProfile(userIdOf(req), uuid.parse(req.params.id)))) throw notFound('Commute');
  res.status(204).end();
});

/** POST /driver-profile/commutes/:id/check - run the early-warning check now (handy for testing alerts). */
driverProfileRouter.post('/commutes/:id/check', async (req, res) => {
  const commute = await getCommuteProfile(userIdOf(req), uuid.parse(req.params.id));
  if (!commute) throw notFound('Commute');
  res.json({ result: await checkCommute(commute, new Date()) });
});
