import { Router } from 'express';
import { z } from 'zod';
import { getDriverProfile } from '../db/models/DriverProfile';
import { getTripWithRoutes, listTrips, saveTripPlan, updateTripStatus } from '../db/models/Trip';
import { requireAuth, userIdOf } from '../middleware/auth';
import { getEngine } from '../services/engine_factory';
import { sendToUser } from '../services/push_notification_service';
import { notFound } from '../utils/http_error';
import { isoDate, place, routeType, uuid } from './schemas';

export const tripRouter = Router();
tripRouter.use(requireAuth);

const planBody = z
  .object({
    origin: place,
    destination: place,
    targetArrival: isoDate.nullish(),
    departAt: isoDate.nullish(),
    bufferMinutes: z.number().int().min(0).max(60).optional(),
    save: z.boolean().default(true),
  })
  .refine((b) => !(b.targetArrival && b.departAt), { message: 'Give either targetArrival or departAt, not both' });

/** POST /trips/plan - "Am I late?" for a trip; persists the plan unless save=false. */
tripRouter.post('/plan', async (req, res) => {
  const userId = userIdOf(req);
  const body = planBody.parse(req.body);
  const profile = await getDriverProfile(userId);
  const plan = await getEngine().plan({
    origin: body.origin,
    destination: body.destination,
    targetArrival: body.targetArrival ?? null,
    departAt: body.departAt ?? null,
    bufferMinutes: body.bufferMinutes ?? profile.buffer_minutes,
  });
  if (body.save) plan.tripId = await saveTripPlan(userId, plan);
  res.json({ ...plan, preferredRouteType: profile.preferred_route_type });
});

tripRouter.get('/', async (req, res) => {
  const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }).parse(req.query);
  res.json({ trips: await listTrips(userIdOf(req), limit) });
});

tripRouter.get('/:id', async (req, res) => {
  const trip = await getTripWithRoutes(userIdOf(req), uuid.parse(req.params.id));
  if (!trip) throw notFound('Trip');
  res.json({ trip });
});

tripRouter.post('/:id/start', async (req, res) => {
  const { routeType: rt } = z.object({ routeType: routeType.default('FASTEST') }).parse(req.body ?? {});
  const trip = await updateTripStatus(userIdOf(req), uuid.parse(req.params.id), 'IN_PROGRESS', rt);
  if (!trip) throw notFound('Trip');
  res.json({ trip });
});

tripRouter.post('/:id/complete', async (req, res) => {
  const userId = userIdOf(req);
  const trip = await updateTripStatus(userId, uuid.parse(req.params.id), 'COMPLETED');
  if (!trip) throw notFound('Trip');
  if (trip.target_arrival && trip.completed_at) {
    const diff = Math.round((trip.completed_at.getTime() - trip.target_arrival.getTime()) / 60_000);
    await sendToUser(userId, {
      kind: 'TRIP',
      title: diff <= 0 ? 'You made it on time' : `Arrived ${diff} min late`,
      body: diff <= 0 ? `Arrived ${-diff} min early at ${trip.destination_label ?? 'your destination'}.` : 'Tip: set a bigger buffer in Settings for this trip.',
      data: { tripId: trip.id },
    });
  }
  res.json({ trip });
});

tripRouter.post('/:id/cancel', async (req, res) => {
  const trip = await updateTripStatus(userIdOf(req), uuid.parse(req.params.id), 'CANCELLED');
  if (!trip) throw notFound('Trip');
  res.json({ trip });
});
