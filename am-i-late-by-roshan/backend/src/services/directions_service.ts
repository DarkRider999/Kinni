/**
 * Real road routing. Providers (MAP_PROVIDER):
 *   osrm      free, no key. Defaults to the public OSRM demo server; point
 *             OSRM_BASE_URL at a self-hosted osrm-backend (GCC extract) for production.
 *   google    Google Directions API (traffic-aware durations, avoid=tolls variant).
 *   mapbox    Mapbox Directions (driving-traffic profile, exclude=toll variant).
 *   haversine offline approximation: straight line x 1.3, used automatically as
 *             the last-resort fallback when the configured provider fails.
 */
import { config, type MapProvider } from '../config';
import { logger } from '../logger';
import { decodePolyline, encodePolyline, haversineKm, type LatLng } from '../utils/geo';
import { fetchJson } from '../utils/http';
import type { Lane, RouteStep } from './types';

export interface DirectionsRoute {
  provider: MapProvider;
  summary: string;
  distanceKm: number;
  /** Duration with no traffic. */
  freeFlowMinutes: number;
  /** Provider's own traffic-aware duration when available (Google/Mapbox), else null. */
  trafficMinutes: number | null;
  path: LatLng[];
  polyline: string;
  steps: RouteStep[];
  avoidsTolls: boolean;
}

export interface DirectionsOptions {
  departure?: Date;
  alternatives?: boolean;
}

const ROAD_FACTOR = 1.3;
const FALLBACK_SPEED_KMH = 60;

// ---------------------------------------------------------------- lane guidance

const DIRECTION_WORDS: Record<string, string> = {
  left: 'left',
  'slight left': 'left',
  'sharp left': 'left',
  right: 'right',
  'slight right': 'right',
  'sharp right': 'right',
  straight: 'straight',
  uturn: 'U-turn',
};

/** Turns lane data (e.g. from OSRM/Mapbox intersections) into a human instruction. */
export function describeLanes(lanes: Lane[], modifier: string | null): string | null {
  if (!lanes.length) return null;
  const total = lanes.length;
  const validIdx = lanes.map((l, i) => (l.valid ? i : -1)).filter((i) => i >= 0);
  if (validIdx.length === 0 || validIdx.length === total) return null;
  const count = validIdx.length;
  const plural = count === 1 ? 'lane' : 'lanes';
  const allLeft = validIdx.every((i, k) => i === k);
  const allRight = validIdx.every((i, k) => i === total - count + k);
  const where = allLeft ? (count === 1 ? 'the left' : `the ${count} left`) : allRight ? (count === 1 ? 'the right' : `the ${count} right`) : `the middle ${count}`;
  const action = modifier && DIRECTION_WORDS[modifier] ? DIRECTION_WORDS[modifier] : null;
  const verb = action === 'straight' ? 'to continue straight' : action ? `to turn ${action}` : 'for your next move';
  return `Use ${where} ${plural} ${verb} (${count} of ${total})`;
}

// ---------------------------------------------------------------- OSRM / Mapbox (same response shape)

interface OsrmStep {
  distance: number;
  duration: number;
  name: string;
  ref?: string;
  maneuver: { type: string; modifier?: string; location: [number, number]; exit?: number };
  intersections?: { lanes?: { indications: string[]; valid: boolean }[] }[];
  geometry?: string;
}

interface OsrmRoute {
  distance: number;
  duration: number;
  duration_typical?: number;
  geometry: string;
  legs: { summary?: string; steps: OsrmStep[] }[];
}

function osrmInstruction(step: OsrmStep): string {
  const road = step.name || step.ref || 'the road';
  const m = step.maneuver;
  const mod = m.modifier ? m.modifier.replace('uturn', 'U-turn') : '';
  switch (m.type) {
    case 'depart':
      return `Head ${mod || 'out'} on ${road}`;
    case 'arrive':
      return 'You have arrived at your destination';
    case 'turn':
    case 'end of road':
      return `Turn ${mod} onto ${road}`;
    case 'continue':
    case 'new name':
      return `Continue ${mod && mod !== 'straight' ? mod + ' ' : ''}on ${road}`;
    case 'merge':
      return `Merge ${mod} onto ${road}`;
    case 'on ramp':
      return `Take the ramp ${mod ? 'on the ' + mod : ''} onto ${road}`.replace(/\s+/g, ' ');
    case 'off ramp':
      return `Take the exit ${mod ? 'on the ' + mod : ''} toward ${road}`.replace(/\s+/g, ' ');
    case 'fork':
      return `Keep ${mod} at the fork onto ${road}`;
    case 'roundabout':
    case 'rotary':
    case 'exit roundabout':
    case 'exit rotary':
      return m.exit ? `At the roundabout, take exit ${m.exit} onto ${road}` : `Go through the roundabout onto ${road}`;
    default:
      return `${m.type.charAt(0).toUpperCase()}${m.type.slice(1)} ${mod} onto ${road}`.replace(/\s+/g, ' ');
  }
}

function osrmStepToRouteStep(step: OsrmStep): RouteStep {
  // Lane data describing the maneuver lives on the last intersection before it.
  const withLanes = [...(step.intersections ?? [])].reverse().find((i) => i.lanes?.length);
  const lanes: Lane[] = (withLanes?.lanes ?? []).map((l) => ({ indications: l.indications, valid: l.valid }));
  const modifier = step.maneuver.modifier ?? null;
  return {
    instruction: osrmInstruction(step),
    maneuver: step.maneuver.type,
    modifier,
    roadName: step.name || step.ref || '',
    distanceM: Math.round(step.distance),
    durationS: Math.round(step.duration),
    location: { lat: step.maneuver.location[1], lng: step.maneuver.location[0] },
    lanes,
    laneGuidance: describeLanes(lanes, modifier),
  };
}

function summarize(steps: RouteStep[], fallback: string): string {
  // The two roads covering the most distance make a readable "via" summary.
  const byRoad = new Map<string, number>();
  for (const s of steps) if (s.roadName) byRoad.set(s.roadName, (byRoad.get(s.roadName) ?? 0) + s.distanceM);
  const top = [...byRoad.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([name]) => name);
  return top.length ? `via ${top.join(' and ')}` : fallback;
}

export function parseOsrmRoutes(data: { code?: string; routes?: OsrmRoute[] }, provider: MapProvider, avoidsTolls = false): DirectionsRoute[] {
  if (data.code && data.code !== 'Ok') throw new Error(`Routing error: ${data.code}`);
  return (data.routes ?? []).map((r) => {
    const steps = r.legs.flatMap((leg) => leg.steps.map(osrmStepToRouteStep));
    const path = decodePolyline(r.geometry, provider === 'mapbox' ? 6 : 5);
    // Mapbox driving-traffic: duration includes live traffic, duration_typical is the usual time.
    const trafficAware = provider === 'mapbox';
    return {
      provider,
      summary: summarize(steps, r.legs[0]?.summary || 'Main route'),
      distanceKm: r.distance / 1000,
      freeFlowMinutes: (trafficAware && r.duration_typical ? Math.min(r.duration_typical, r.duration) : r.duration) / 60,
      trafficMinutes: trafficAware ? r.duration / 60 : null,
      path,
      polyline: encodePolyline(path),
      steps,
      avoidsTolls,
    };
  });
}

async function osrmRoutes(o: LatLng, d: LatLng, opts: DirectionsOptions): Promise<DirectionsRoute[]> {
  const coords = `${o.lng},${o.lat};${d.lng},${d.lat}`;
  const url = `${config.osrmBaseUrl}/route/v1/driving/${coords}?alternatives=${opts.alternatives === false ? 'false' : '3'}&steps=true&overview=full&geometries=polyline`;
  const data = await fetchJson<{ code: string; routes: OsrmRoute[] }>(url, { headers: { 'User-Agent': config.osmUserAgent } });
  return parseOsrmRoutes(data, 'osrm');
}

async function mapboxRoutes(o: LatLng, d: LatLng, opts: DirectionsOptions): Promise<DirectionsRoute[]> {
  if (!config.mapboxAccessToken) throw new Error('MAPBOX_ACCESS_TOKEN is not set');
  const coords = `${o.lng},${o.lat};${d.lng},${d.lat}`;
  const base = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?steps=true&overview=full&geometries=polyline6&access_token=${config.mapboxAccessToken}`;
  const [main, noToll] = await Promise.allSettled([
    fetchJson<{ code: string; routes: OsrmRoute[] }>(`${base}&alternatives=${opts.alternatives === false ? 'false' : 'true'}`),
    fetchJson<{ code: string; routes: OsrmRoute[] }>(`${base}&alternatives=false&exclude=toll`),
  ]);
  if (main.status === 'rejected') throw main.reason;
  const routes = parseOsrmRoutes(main.value, 'mapbox');
  if (noToll.status === 'fulfilled') routes.push(...parseOsrmRoutes(noToll.value, 'mapbox', true));
  return routes;
}

// ---------------------------------------------------------------- Google

interface GoogleStep {
  distance: { value: number };
  duration: { value: number };
  html_instructions: string;
  maneuver?: string;
  start_location: { lat: number; lng: number };
}

interface GoogleRoute {
  summary: string;
  overview_polyline: { points: string };
  legs: { distance: { value: number }; duration: { value: number }; duration_in_traffic?: { value: number }; steps: GoogleStep[] }[];
}

const stripHtml = (html: string) =>
  html
    .replace(/<div[^>]*>/g, '. ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

export function parseGoogleRoutes(data: { status: string; routes?: GoogleRoute[]; error_message?: string }, avoidsTolls = false): DirectionsRoute[] {
  if (data.status !== 'OK') throw new Error(`Google Directions: ${data.status} ${data.error_message ?? ''}`.trim());
  return (data.routes ?? []).map((r) => {
    const leg = r.legs[0];
    const path = decodePolyline(r.overview_polyline.points);
    const steps: RouteStep[] = leg.steps.map((s) => {
      const maneuver = s.maneuver ?? 'straight';
      const modifier = maneuver.includes('left') ? 'left' : maneuver.includes('right') ? 'right' : maneuver === 'straight' ? 'straight' : null;
      const text = stripHtml(s.html_instructions);
      const road = /onto ([^.]+)/.exec(text)?.[1] ?? /on ([^.]+)/.exec(text)?.[1] ?? '';
      return {
        instruction: text,
        maneuver,
        modifier,
        roadName: road.trim(),
        distanceM: s.distance.value,
        durationS: s.duration.value,
        location: s.start_location,
        lanes: [],
        // Google's web service has no lane data; derive a keep-left/right hint from ramp/fork maneuvers.
        laneGuidance: /ramp|fork|keep|merge/.test(maneuver) && modifier ? `Move to the ${modifier} lanes early` : null,
      };
    });
    return {
      provider: 'google' as const,
      summary: r.summary ? `via ${r.summary}` : summarize(steps, 'Main route'),
      distanceKm: leg.distance.value / 1000,
      freeFlowMinutes: leg.duration.value / 60,
      trafficMinutes: leg.duration_in_traffic ? leg.duration_in_traffic.value / 60 : null,
      path,
      polyline: encodePolyline(path),
      steps,
      avoidsTolls,
    };
  });
}

async function googleRoutes(o: LatLng, d: LatLng, opts: DirectionsOptions): Promise<DirectionsRoute[]> {
  if (!config.googleMapsApiKey) throw new Error('GOOGLE_MAPS_API_KEY is not set');
  const departure = opts.departure && opts.departure.getTime() > Date.now() ? Math.floor(opts.departure.getTime() / 1000) : 'now';
  const base = `https://maps.googleapis.com/maps/api/directions/json?origin=${o.lat},${o.lng}&destination=${d.lat},${d.lng}&departure_time=${departure}&key=${config.googleMapsApiKey}`;
  const [main, noToll] = await Promise.allSettled([
    fetchJson<{ status: string; routes: GoogleRoute[] }>(`${base}&alternatives=${opts.alternatives === false ? 'false' : 'true'}`),
    fetchJson<{ status: string; routes: GoogleRoute[] }>(`${base}&avoid=tolls`),
  ]);
  if (main.status === 'rejected') throw main.reason;
  const routes = parseGoogleRoutes(main.value);
  if (noToll.status === 'fulfilled' && noToll.value.status === 'OK') routes.push(...parseGoogleRoutes(noToll.value, true));
  return routes;
}

// ---------------------------------------------------------------- haversine fallback

export function haversineRoute(o: LatLng, d: LatLng): DirectionsRoute {
  const straightKm = haversineKm(o, d);
  const distanceKm = straightKm * ROAD_FACTOR;
  const freeFlowMinutes = Math.max(1, (distanceKm / FALLBACK_SPEED_KMH) * 60);
  const path = [o, d];
  return {
    provider: 'haversine',
    summary: 'Estimated route (road data unavailable)',
    distanceKm,
    freeFlowMinutes,
    trafficMinutes: null,
    path,
    polyline: encodePolyline(path),
    steps: [
      {
        instruction: 'Head toward your destination',
        maneuver: 'depart',
        modifier: null,
        roadName: '',
        distanceM: Math.round(distanceKm * 1000),
        durationS: Math.round(freeFlowMinutes * 60),
        location: o,
        lanes: [],
        laneGuidance: null,
      },
      {
        instruction: 'You have arrived at your destination',
        maneuver: 'arrive',
        modifier: null,
        roadName: '',
        distanceM: 0,
        durationS: 0,
        location: d,
        lanes: [],
        laneGuidance: null,
      },
    ],
    avoidsTolls: false,
  };
}

// ---------------------------------------------------------------- public API

const PROVIDERS: Record<Exclude<MapProvider, 'haversine'>, typeof osrmRoutes> = {
  osrm: osrmRoutes,
  google: googleRoutes,
  mapbox: mapboxRoutes,
};

/** Drops near-identical alternatives (same distance within 2% and same summary). */
function dedupe(routes: DirectionsRoute[]): DirectionsRoute[] {
  const out: DirectionsRoute[] = [];
  for (const r of routes) {
    const dup = out.find((x) => x.summary === r.summary && Math.abs(x.distanceKm - r.distanceKm) / Math.max(x.distanceKm, 0.1) < 0.02);
    if (!dup) out.push(r);
    else if (r.avoidsTolls) dup.avoidsTolls = true;
  }
  return out;
}

export async function getRoutes(origin: LatLng, destination: LatLng, opts: DirectionsOptions = {}): Promise<DirectionsRoute[]> {
  if (config.mapProvider !== 'haversine') {
    try {
      const routes = dedupe(await PROVIDERS[config.mapProvider](origin, destination, opts));
      if (routes.length) return routes.slice(0, 4);
    } catch (err) {
      logger.warn({ provider: config.mapProvider, err: (err as Error).message }, 'Directions provider failed; using haversine estimate');
    }
  }
  return [haversineRoute(origin, destination)];
}
