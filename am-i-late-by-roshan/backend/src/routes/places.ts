import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { optionalAuth } from '../middleware/auth';
import { reverseGeocode, searchPlaces } from '../services/places_service';
import { latLngQuery } from './schemas';

export const placesRouter = Router();
placesRouter.use(optionalAuth);
// Nominatim's free tier asks for <= 1 request/second per app; cache + limit per client.
placesRouter.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false }));

/** GET /places/search?q=...[&lat&lng] */
placesRouter.get('/search', async (req, res) => {
  const q = z
    .object({
      q: z.string().trim().min(1).max(120),
      lat: z.coerce.number().min(-90).max(90).optional(),
      lng: z.coerce.number().min(-180).max(180).optional(),
    })
    .parse(req.query);
  const near = q.lat != null && q.lng != null ? { lat: q.lat, lng: q.lng } : undefined;
  res.json({ results: await searchPlaces(q.q, near) });
});

placesRouter.get('/reverse', async (req, res) => {
  const q = latLngQuery.parse(req.query);
  res.json({ place: await reverseGeocode({ lat: q.lat, lng: q.lng }) });
});
