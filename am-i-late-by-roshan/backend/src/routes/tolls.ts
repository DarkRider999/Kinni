import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth } from '../middleware/auth';
import { getRoutes } from '../services/directions_service';
import { darbFeeAed, estimateTolls, salikFeeAed, TOLL_GATES } from '../services/toll_service';
import { decodePolyline } from '../utils/geo';
import { badRequest } from '../utils/http_error';
import { isoDate, latLng } from './schemas';

export const tollsRouter = Router();
tollsRouter.use(optionalAuth);

tollsRouter.get('/gates', (_req, res) => {
  const now = new Date();
  res.json({
    gates: TOLL_GATES.map((g) => ({ ...g, currentFeeAed: g.system === 'SALIK' ? salikFeeAed(now) : darbFeeAed(now) })),
  });
});

/**
 * POST /tolls/estimate
 * Either { polyline } (encoded, precision 5) or { origin, destination } (routed server-side).
 */
tollsRouter.post('/estimate', async (req, res) => {
  const body = z
    .object({
      polyline: z.string().max(200_000).optional(),
      origin: latLng.optional(),
      destination: latLng.optional(),
      departure: isoDate.optional(),
      durationMinutes: z.number().min(0).max(1440).optional(),
      publicHoliday: z.boolean().optional(),
    })
    .parse(req.body);
  const departure = body.departure ?? new Date();
  if (body.polyline) {
    const path = decodePolyline(body.polyline);
    return res.json(estimateTolls(path, departure, body.durationMinutes ?? 0, { publicHoliday: body.publicHoliday }));
  }
  if (!body.origin || !body.destination) throw badRequest('Provide either polyline or origin + destination');
  const routes = await getRoutes(body.origin, body.destination, { departure });
  res.json({
    routes: routes.map((r) => ({
      summary: r.summary,
      distanceKm: Math.round(r.distanceKm * 10) / 10,
      ...estimateTolls(r.path, departure, body.durationMinutes ?? r.freeFlowMinutes, { publicHoliday: body.publicHoliday }),
    })),
  });
});
