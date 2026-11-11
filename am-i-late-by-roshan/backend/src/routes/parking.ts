import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth } from '../middleware/auth';
import { estimateParkingTariff, nearbyCarParks } from '../services/parking_service';
import { isoDate, latLngQuery } from './schemas';

export const parkingRouter = Router();
parkingRouter.use(optionalAuth);

/** GET /parking/nearby?lat&lng[&at=ISO][&radius=m] */
parkingRouter.get('/nearby', async (req, res) => {
  const q = latLngQuery.extend({ at: isoDate.optional(), radius: z.coerce.number().int().min(100).max(3000).default(800) }).parse(req.query);
  const p = { lat: q.lat, lng: q.lng };
  const [carParks] = await Promise.all([nearbyCarParks(p, q.radius)]);
  res.json({ tariff: estimateParkingTariff(p, q.at ?? new Date()), carParks });
});
