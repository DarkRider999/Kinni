import { describe, expect, it } from 'vitest';
import {
  closestPointOnPath,
  decodePolyline,
  emirateOf,
  encodePolyline,
  formatUaeTime,
  haversineKm,
  simplifyPath,
  toLineStringWkt,
  uaeDateAt,
  uaeLocal,
} from '../src/utils/geo';

describe('geo utils', () => {
  it('computes haversine distance (Dubai Mall to Dubai Marina Mall is ~17 km)', () => {
    const d = haversineKm({ lat: 25.1972, lng: 55.2796 }, { lat: 25.0763, lng: 55.1401 });
    expect(d).toBeGreaterThan(19);
    expect(d).toBeLessThan(20);
  });

  it('decodes the reference Google polyline', () => {
    const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(pts).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });

  it('round-trips encode/decode', () => {
    const pts = [
      { lat: 25.2048, lng: 55.2708 },
      { lat: 25.1, lng: 55.15 },
      { lat: 24.4539, lng: 54.3773 },
    ];
    expect(decodePolyline(encodePolyline(pts))).toEqual(pts);
    expect(encodePolyline([{ lat: 38.5, lng: -120.2 }, { lat: 40.7, lng: -120.95 }, { lat: 43.252, lng: -126.453 }])).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  });

  it('finds the closest point and fraction along a path', () => {
    const path = [
      { lat: 25.0, lng: 55.0 },
      { lat: 25.0, lng: 55.1 },
    ];
    const mid = closestPointOnPath({ lat: 25.001, lng: 55.05 }, path);
    expect(mid.distanceM).toBeGreaterThan(100);
    expect(mid.distanceM).toBeLessThan(120);
    expect(mid.fraction).toBeCloseTo(0.5, 1);
  });

  it('converts to UAE local time (UTC+4) with ISO weekdays', () => {
    const t = uaeLocal(new Date('2026-09-27T20:30:00Z')); // Sunday 20:30Z = Monday 00:30 UAE
    expect(t).toMatchObject({ hour: 0, minute: 30, isoDow: 1, dateString: '2026-09-28' });
    expect(formatUaeTime(new Date('2026-09-28T04:05:00Z'))).toBe('08:05');
  });

  it('builds a UTC instant from a UAE date and wall-clock time', () => {
    expect(uaeDateAt('2026-09-28', '08:30').toISOString()).toBe('2026-09-28T04:30:00.000Z');
  });

  it.each([
    [{ lat: 25.1972, lng: 55.2796 }, 'Dubai'],
    [{ lat: 25.3257, lng: 55.3935 }, 'Sharjah'],
    [{ lat: 24.4764, lng: 54.3239 }, 'Abu Dhabi'],
    [{ lat: 25.3993, lng: 55.4787 }, 'Ajman'],
    [{ lat: 51.5, lng: -0.12 }, 'Unknown'],
  ])('emirateOf(%o) = %s', (p, expected) => {
    expect(emirateOf(p)).toBe(expected);
  });

  it('simplifies long paths and makes valid WKT', () => {
    const long = Array.from({ length: 1000 }, (_, i) => ({ lat: 25 + i / 1e4, lng: 55 }));
    const s = simplifyPath(long, 100);
    expect(s).toHaveLength(100);
    expect(s[0]).toEqual(long[0]);
    expect(s[99]).toEqual(long[999]);
    expect(toLineStringWkt([{ lat: 1, lng: 2 }])).toBe('LINESTRING(2 1, 2 1)');
  });
});
