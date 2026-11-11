/**
 * UAE road tolls: Salik (Dubai) and DARB (Abu Dhabi).
 *
 * Gate coordinates are approximate (to within a few hundred metres) and are
 * matched against a route polyline with a tolerance radius. Tariffs follow the
 * published rules at the time of writing — review them when RTA/ITC change
 * pricing (these constants are the single place to update).
 *
 * Salik variable pricing (since 31 Jan 2025):
 *   Mon-Sat  06:00-10:00 & 16:00-20:00  AED 6 (peak)
 *            10:00-16:00 & 20:00-01:00  AED 4 (off-peak)
 *            01:00-06:00                free
 *   Sunday   AED 4 all day except 01:00-06:00 free (public holidays/events: same as Sunday)
 *   Al Mamzar North+South, and Al Safa+Al Safa South, are charged once when
 *   both are passed in the same direction within an hour.
 *
 * DARB:
 *   Mon-Sat 07:00-09:00 & 17:00-19:00  AED 4 per crossing; otherwise free.
 *   Sundays and public holidays free. Daily cap AED 16 per vehicle.
 */
import { closestPointOnPath, type LatLng, uaeLocal } from '../utils/geo';
import type { TollCrossing } from './types';

export type TollSystem = 'SALIK' | 'DARB';

export interface TollGate {
  id: string;
  name: string;
  system: TollSystem;
  lat: number;
  lng: number;
  /** Gates sharing a pairGroup are charged once per trip. */
  pairGroup?: string;
}

export const TOLL_GATES: TollGate[] = [
  { id: 'SALIK_AL_BARSHA', name: 'Al Barsha', system: 'SALIK', lat: 25.1106, lng: 55.1873 },
  { id: 'SALIK_AL_GARHOUD', name: 'Al Garhoud Bridge', system: 'SALIK', lat: 25.2226, lng: 55.337 },
  { id: 'SALIK_AL_MAKTOUM', name: 'Al Maktoum Bridge', system: 'SALIK', lat: 25.2518, lng: 55.3196 },
  { id: 'SALIK_AL_MAMZAR_S', name: 'Al Mamzar South', system: 'SALIK', lat: 25.2925, lng: 55.3668, pairGroup: 'MAMZAR' },
  { id: 'SALIK_AL_MAMZAR_N', name: 'Al Mamzar North', system: 'SALIK', lat: 25.2995, lng: 55.3735, pairGroup: 'MAMZAR' },
  { id: 'SALIK_AL_SAFA', name: 'Al Safa', system: 'SALIK', lat: 25.1893, lng: 55.256, pairGroup: 'SAFA' },
  { id: 'SALIK_AL_SAFA_SOUTH', name: 'Al Safa South', system: 'SALIK', lat: 25.164, lng: 55.225, pairGroup: 'SAFA' },
  { id: 'SALIK_AIRPORT_TUNNEL', name: 'Airport Tunnel', system: 'SALIK', lat: 25.2583, lng: 55.3822 },
  { id: 'SALIK_JEBEL_ALI', name: 'Jebel Ali', system: 'SALIK', lat: 25.009, lng: 55.096 },
  { id: 'SALIK_BUSINESS_BAY', name: 'Business Bay Crossing', system: 'SALIK', lat: 25.188, lng: 55.299 },
  { id: 'DARB_SHEIKH_ZAYED_BRIDGE', name: 'Sheikh Zayed Bridge', system: 'DARB', lat: 24.46, lng: 54.404 },
  { id: 'DARB_SHEIKH_KHALIFA_BRIDGE', name: 'Sheikh Khalifa Bridge', system: 'DARB', lat: 24.4865, lng: 54.4535 },
  { id: 'DARB_AL_MAQTA_BRIDGE', name: 'Al Maqta Bridge', system: 'DARB', lat: 24.4133, lng: 54.4953 },
  { id: 'DARB_MUSSAFAH_BRIDGE', name: 'Mussafah Bridge', system: 'DARB', lat: 24.393, lng: 54.5053 },
];

export const SALIK_PEAK_AED = 6;
export const SALIK_OFF_PEAK_AED = 4;
export const DARB_PEAK_AED = 4;
export const DARB_DAILY_CAP_AED = 16;
export const GATE_MATCH_RADIUS_M = 180;

const inRange = (minutes: number, startH: number, endH: number) => minutes >= startH * 60 && minutes < endH * 60;

export function salikFeeAed(at: Date, opts: { publicHoliday?: boolean } = {}): number {
  const t = uaeLocal(at);
  if (inRange(t.minutesOfDay, 1, 6)) return 0;
  if (t.isoDow === 7 || opts.publicHoliday) return SALIK_OFF_PEAK_AED;
  if (inRange(t.minutesOfDay, 6, 10) || inRange(t.minutesOfDay, 16, 20)) return SALIK_PEAK_AED;
  return SALIK_OFF_PEAK_AED;
}

export function darbFeeAed(at: Date, opts: { publicHoliday?: boolean } = {}): number {
  const t = uaeLocal(at);
  if (t.isoDow === 7 || opts.publicHoliday) return 0;
  if (inRange(t.minutesOfDay, 7, 9) || inRange(t.minutesOfDay, 17, 19)) return DARB_PEAK_AED;
  return 0;
}

export function gateFeeAed(gate: TollGate, at: Date, opts: { publicHoliday?: boolean } = {}): number {
  return gate.system === 'SALIK' ? salikFeeAed(at, opts) : darbFeeAed(at, opts);
}

/** Gates within the match radius of the path, ordered by where along the path they are passed. */
export function findGatesOnPath(path: LatLng[], radiusM = GATE_MATCH_RADIUS_M): { gate: TollGate; fraction: number }[] {
  if (path.length < 2) return [];
  return TOLL_GATES.map((gate) => ({ gate, ...closestPointOnPath(gate, path) }))
    .filter((g) => g.distanceM <= radiusM)
    .sort((a, b) => a.fraction - b.fraction)
    .map(({ gate, fraction }) => ({ gate, fraction }));
}

export interface TollEstimate {
  totalAed: number;
  crossings: TollCrossing[];
  systems: TollSystem[];
  notes: string[];
}

/**
 * Estimates the tolls for driving `path`, leaving at `departure` and taking
 * `durationMinutes` (each gate is priced at the time it is expected to be passed).
 */
export function estimateTolls(
  path: LatLng[],
  departure: Date,
  durationMinutes = 0,
  opts: { publicHoliday?: boolean; alreadyPaidDarbTodayAed?: number } = {},
): TollEstimate {
  const matched = findGatesOnPath(path);
  const crossings: TollCrossing[] = [];
  const chargedGroups = new Set<string>();
  const notes: string[] = [];
  let darbToday = opts.alreadyPaidDarbTodayAed ?? 0;

  for (const { gate, fraction } of matched) {
    const passAt = new Date(departure.getTime() + fraction * durationMinutes * 60_000);
    let fee = gateFeeAed(gate, passAt, opts);
    if (gate.pairGroup) {
      if (chargedGroups.has(gate.pairGroup)) {
        fee = 0;
        notes.push(`${gate.name}: no extra charge (paired gate already charged within the hour)`);
      }
      chargedGroups.add(gate.pairGroup);
    }
    if (gate.system === 'DARB') {
      const capped = Math.max(0, Math.min(fee, DARB_DAILY_CAP_AED - darbToday));
      if (capped < fee) notes.push(`${gate.name}: DARB daily cap of AED ${DARB_DAILY_CAP_AED} reached`);
      fee = capped;
      darbToday += fee;
    }
    crossings.push({ gateId: gate.id, name: gate.name, system: gate.system, feeAed: fee, lat: gate.lat, lng: gate.lng });
  }

  const totalAed = crossings.reduce((sum, c) => sum + c.feeAed, 0);
  const systems = [...new Set(crossings.map((c) => c.system))];
  return { totalAed, crossings, systems, notes };
}
