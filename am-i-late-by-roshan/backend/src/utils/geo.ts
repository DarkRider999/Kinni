export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pathLengthKm(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += haversineKm(path[i - 1], path[i]);
  return total;
}

/** Distance in metres from p to segment a-b, using a local equirectangular projection (accurate to <0.5% at city scale). */
export function distanceToSegmentM(p: LatLng, a: LatLng, b: LatLng): number {
  const cosLat = Math.cos(toRad(p.lat));
  const kx = 111_320 * cosLat;
  const ky = 110_574;
  const ax = (a.lng - p.lng) * kx;
  const ay = (a.lat - p.lat) * ky;
  const bx = (b.lng - p.lng) * kx;
  const by = (b.lat - p.lat) * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : -(ax * dx + ay * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.sqrt(cx * cx + cy * cy);
}

/** Minimum distance (metres) from p to a polyline, plus the fraction (0..1) of path length at the closest point. */
export function closestPointOnPath(p: LatLng, path: LatLng[]): { distanceM: number; fraction: number } {
  if (path.length === 0) return { distanceM: Infinity, fraction: 0 };
  if (path.length === 1) return { distanceM: haversineKm(p, path[0]) * 1000, fraction: 0 };
  const total = pathLengthKm(path) || 1;
  let best = Infinity;
  let bestAlong = 0;
  let along = 0;
  for (let i = 1; i < path.length; i++) {
    const segKm = haversineKm(path[i - 1], path[i]);
    const d = distanceToSegmentM(p, path[i - 1], path[i]);
    if (d < best) {
      best = d;
      // Approximate position along the segment by distance to its start.
      const fromStart = Math.min(segKm, haversineKm(path[i - 1], p));
      bestAlong = along + fromStart;
    }
    along += segKm;
  }
  return { distanceM: best, fraction: Math.min(1, bestAlong / total) };
}

/** Google encoded polyline algorithm (also used by OSRM and Mapbox with precision 5). */
export function decodePolyline(encoded: string, precision = 5): LatLng[] {
  const factor = 10 ** precision;
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    for (const which of ['lat', 'lng'] as const) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 'lat') lat += delta;
      else lng += delta;
    }
    points.push({ lat: lat / factor, lng: lng / factor });
  }
  return points;
}

export function encodePolyline(points: LatLng[], precision = 5): string {
  const factor = 10 ** precision;
  let out = '';
  let prevLat = 0;
  let prevLng = 0;
  const encodeValue = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    let chunk = '';
    while (v >= 0x20) {
      chunk += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    return chunk + String.fromCharCode(v + 63);
  };
  for (const p of points) {
    const lat = Math.round(p.lat * factor);
    const lng = Math.round(p.lng * factor);
    out += encodeValue(lat - prevLat) + encodeValue(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return out;
}

/** Evenly thins a path to at most maxPoints (keeps first and last). */
export function simplifyPath(path: LatLng[], maxPoints = 400): LatLng[] {
  if (path.length <= maxPoints) return path;
  const step = (path.length - 1) / (maxPoints - 1);
  const out: LatLng[] = [];
  for (let i = 0; i < maxPoints; i++) out.push(path[Math.round(i * step)]);
  return out;
}

/** WKT LINESTRING for PostGIS (lng lat order). Duplicates a single point so the geometry is valid. */
export function toLineStringWkt(path: LatLng[]): string {
  const pts = path.length === 1 ? [path[0], path[0]] : path;
  return `LINESTRING(${pts.map((p) => `${p.lng} ${p.lat}`).join(', ')})`;
}

export function isValidLatLng(p: LatLng): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}

export type Emirate = 'Dubai' | 'Abu Dhabi' | 'Sharjah' | 'Ajman' | 'Umm Al Quwain' | 'Ras Al Khaimah' | 'Fujairah' | 'Unknown';

/** Coarse emirate lookup by bounding boxes. Good enough for tariff/heuristic selection, not for legal boundaries. */
export function emirateOf(p: LatLng): Emirate {
  const { lat, lng } = p;
  if (lat < 22.5 || lat > 26.2 || lng < 51.5 || lng > 56.5) return 'Unknown';
  if (lng >= 55.9) return 'Fujairah';
  if (lat >= 25.55) return 'Ras Al Khaimah';
  if (lat >= 25.47) return 'Umm Al Quwain';
  if (lat >= 25.37 && lng >= 55.42) return 'Ajman';
  if (lat >= 25.27 && lng >= 55.36) return 'Sharjah';
  if (lat >= 24.75 && lng >= 54.95) return 'Dubai';
  return 'Abu Dhabi';
}

export interface LocalTime {
  hour: number;
  minute: number;
  minutesOfDay: number;
  /** ISO weekday: 1 = Monday ... 7 = Sunday. */
  isoDow: number;
  dateString: string;
}

/** UAE local time (Asia/Dubai is a fixed UTC+4, no DST). */
export function uaeLocal(date: Date): LocalTime {
  const shifted = new Date(date.getTime() + 4 * 3600_000);
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  const dow = shifted.getUTCDay();
  return {
    hour,
    minute,
    minutesOfDay: hour * 60 + minute,
    isoDow: dow === 0 ? 7 : dow,
    dateString: shifted.toISOString().slice(0, 10),
  };
}

/** Builds a UTC Date for a UAE-local calendar date + "HH:MM[:SS]" wall-clock time. */
export function uaeDateAt(dateString: string, time: string): Date {
  const [h, m, s] = time.split(':').map((x) => Number(x));
  const base = Date.parse(`${dateString}T00:00:00Z`);
  return new Date(base + ((h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0)) * 1000 - 4 * 3600_000);
}

export function formatUaeTime(date: Date): string {
  const t = uaeLocal(date);
  return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
}
