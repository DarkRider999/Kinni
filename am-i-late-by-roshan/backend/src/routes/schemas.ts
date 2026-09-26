import { z } from 'zod';

export const latLng = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const place = latLng.extend({
  label: z.string().max(200).nullish(),
});

export const isoDate = z.iso.datetime({ offset: true }).transform((s) => new Date(s));

export const routeType = z.enum(['FASTEST', 'CHEAPEST', 'LOW_STRESS']);

export const latLngQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const uuid = z.uuid();

export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM (24h)');
