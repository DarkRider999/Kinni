/**
 * Parking near a destination: nearby car parks from OpenStreetMap (Overpass,
 * free) plus an hourly tariff estimate for public on-street parking.
 *
 * Tariffs (review when authorities change them):
 *  Dubai (Parkin, from Apr 2025): Mon-Sat 08:00-22:00 paid. Peak 08-10 & 16-20:
 *    premium AED 6/h, standard AED 4/h; off-peak premium AED 4/h, standard AED 2/h.
 *    Free on Sundays/public holidays and 22:00-08:00.
 *  Abu Dhabi (Mawaqif): standard AED 2/h, premium AED 3/h, Mon-Sat 08:00-24:00; free Sundays.
 *  Sharjah: ~AED 2/h (some zones AED 3), 08:00-22:00; free Fridays.
 */
import { config } from '../config';
import { logger } from '../logger';
import { emirateOf, haversineKm, type LatLng, uaeLocal } from '../utils/geo';
import { fetchJson, TtlCache } from '../utils/http';

export interface ParkingTariff {
  emirate: string;
  standardAedPerHour: number;
  premiumAedPerHour: number;
  free: boolean;
  note: string;
}

export function estimateParkingTariff(p: LatLng, at: Date): ParkingTariff {
  const emirate = emirateOf(p);
  const t = uaeLocal(at);
  const h = t.minutesOfDay / 60;
  if (emirate === 'Dubai') {
    if (t.isoDow === 7 || h < 8 || h >= 22) return { emirate, standardAedPerHour: 0, premiumAedPerHour: 0, free: true, note: 'Public parking is free now (Sunday or 22:00-08:00)' };
    const peak = (h >= 8 && h < 10) || (h >= 16 && h < 20);
    return peak
      ? { emirate, standardAedPerHour: 4, premiumAedPerHour: 6, free: false, note: 'Peak-hour Parkin tariff' }
      : { emirate, standardAedPerHour: 2, premiumAedPerHour: 4, free: false, note: 'Off-peak Parkin tariff' };
  }
  if (emirate === 'Abu Dhabi') {
    if (t.isoDow === 7 || h < 8) return { emirate, standardAedPerHour: 0, premiumAedPerHour: 0, free: true, note: 'Mawaqif parking is free now' };
    return { emirate, standardAedPerHour: 2, premiumAedPerHour: 3, free: false, note: 'Mawaqif tariff' };
  }
  if (emirate === 'Sharjah') {
    if (t.isoDow === 5 || h < 8 || h >= 22) return { emirate, standardAedPerHour: 0, premiumAedPerHour: 0, free: true, note: 'Public parking is free now (Friday or 22:00-08:00)' };
    return { emirate, standardAedPerHour: 2, premiumAedPerHour: 3, free: false, note: 'Sharjah municipal tariff' };
  }
  return { emirate, standardAedPerHour: 2, premiumAedPerHour: 3, free: false, note: 'Estimated tariff' };
}

export interface CarPark {
  name: string;
  lat: number;
  lng: number;
  distanceM: number;
  fee: string | null;
  capacity: number | null;
  type: string | null;
}

const lotCache = new TtlCache<CarPark[]>(3600_000, 500);

export async function nearbyCarParks(p: LatLng, radiusM = 800): Promise<CarPark[]> {
  const key = `${p.lat.toFixed(3)},${p.lng.toFixed(3)},${radiusM}`;
  const hit = lotCache.get(key);
  if (hit) return hit;
  try {
    const q = `[out:json][timeout:8];nwr(around:${radiusM},${p.lat},${p.lng})[amenity=parking];out center tags 30;`;
    const data = await fetchJson<{ elements: { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] }>(
      config.overpassUrl,
      { method: 'POST', body: new URLSearchParams({ data: q }), headers: { 'User-Agent': config.osmUserAgent } },
    );
    const lots = data.elements
      .map((e): CarPark | null => {
        const lat = e.lat ?? e.center?.lat;
        const lng = e.lon ?? e.center?.lon;
        if (lat == null || lng == null) return null;
        const tags = e.tags ?? {};
        return {
          name: tags.name ?? (tags.parking === 'multi-storey' ? 'Multi-storey car park' : 'Car park'),
          lat,
          lng,
          distanceM: Math.round(haversineKm(p, { lat, lng }) * 1000),
          fee: tags.fee ?? null,
          capacity: tags.capacity ? Number(tags.capacity) || null : null,
          type: tags.parking ?? null,
        };
      })
      .filter((x): x is CarPark => x !== null)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 15);
    lotCache.set(key, lots);
    return lots;
  } catch (err) {
    logger.debug({ err: (err as Error).message }, 'Car park lookup failed');
    return [];
  }
}
