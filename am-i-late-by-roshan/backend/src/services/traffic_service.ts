/**
 * Traffic forecasts (AI service), crowd-sourced speed snapshots (Postgres +
 * Redis fan-out) and speed-limit lookup (OpenStreetMap Overpass, free).
 */
import { config } from '../config';
import { query, queryOne } from '../db/connection';
import { logger } from '../logger';
import { CHANNELS, getBus } from '../redis/pubsub';
import type { LatLng } from '../utils/geo';
import { fetchJson, TtlCache } from '../utils/http';
import { getAiClient, type TrafficForecast } from './ai_client';

export async function getTrafficForecast(origin: LatLng, destination: LatLng, departure: Date): Promise<TrafficForecast & { crowdSpeedRatio: number | null }> {
  const crowd = await crowdSpeedNear(origin);
  const forecast = await getAiClient().predictTraffic({
    origin,
    destination,
    departure_time: departure.toISOString(),
    crowd_speed_ratio: Math.abs(departure.getTime() - Date.now()) < 20 * 60_000 ? crowd?.ratio ?? null : null,
  });
  return { ...forecast, crowdSpeedRatio: crowd?.ratio ?? null };
}

export interface SnapshotInput {
  lat: number;
  lng: number;
  speedKmh: number;
  speedLimitKmh?: number | null;
  heading?: number | null;
}

export async function recordSnapshot(s: SnapshotInput): Promise<void> {
  await query(
    `INSERT INTO traffic_snapshots (location, speed_kmh, speed_limit_kmh, heading)
     VALUES (ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3, $4, $5)`,
    [s.lng, s.lat, s.speedKmh, s.speedLimitKmh ?? null, s.heading ?? null],
  );
  await getBus().publish(CHANNELS.trafficUpdates, {
    lat: Math.round(s.lat * 1000) / 1000,
    lng: Math.round(s.lng * 1000) / 1000,
    speedKmh: s.speedKmh,
    speedLimitKmh: s.speedLimitKmh ?? null,
    at: new Date().toISOString(),
  });
}

/** Average observed speed / limit near a point over the last 15 minutes (needs >= 3 samples). */
export async function crowdSpeedNear(p: LatLng, radiusM = 400): Promise<{ avgSpeedKmh: number; ratio: number | null; samples: number } | null> {
  try {
    const row = await queryOne<{ avg_speed: number | null; avg_ratio: number | null; samples: number }>(
      `SELECT avg(speed_kmh)::float AS avg_speed,
              avg(speed_kmh / NULLIF(speed_limit_kmh, 0))::float AS avg_ratio,
              count(*)::int AS samples
       FROM traffic_snapshots
       WHERE captured_at > now() - interval '15 minutes'
         AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)`,
      [p.lng, p.lat, radiusM],
    );
    if (!row || row.samples < 3 || row.avg_speed == null) return null;
    return { avgSpeedKmh: row.avg_speed, ratio: row.avg_ratio, samples: row.samples };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ speed limits

export interface SpeedLimit {
  speedLimitKmh: number | null;
  roadName: string | null;
  source: 'osm-maxspeed' | 'osm-road-class' | 'road-name' | 'unknown';
}

/** Well-known UAE roads, used when OSM has no maxspeed tag or is unreachable. */
const KNOWN_ROADS: [RegExp, number][] = [
  [/sheikh zayed (road|rd)|e ?11\b|e11/i, 100],
  [/sheikh mohammed bin zayed|e ?311/i, 110],
  [/emirates (road|rd)|e ?611/i, 110],
  [/al khail/i, 100],
  [/al ittihad/i, 100],
  [/al maktoum airport|e ?77/i, 120],
  [/abu dhabi.?(al )?ain|e ?22/i, 140],
  [/hessa|al asayel|umm suqeim/i, 80],
];

const ROAD_CLASS_DEFAULTS: Record<string, number> = {
  motorway: 120,
  trunk: 100,
  primary: 80,
  secondary: 60,
  tertiary: 60,
  motorway_link: 80,
  trunk_link: 60,
  primary_link: 60,
  residential: 40,
  living_street: 25,
  service: 25,
  unclassified: 40,
};

export function parseMaxspeed(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = /^(\d+)\s*(mph)?/.exec(raw.trim());
  if (!m) return null;
  const v = Number(m[1]);
  return m[2] ? Math.round(v * 1.609) : v;
}

export function speedLimitFromRoadName(name: string | null | undefined): number | null {
  if (!name) return null;
  return KNOWN_ROADS.find(([re]) => re.test(name))?.[1] ?? null;
}

const limitCache = new TtlCache<SpeedLimit>(6 * 3600_000, 20_000);

export async function getSpeedLimit(p: LatLng, roadNameHint?: string | null): Promise<SpeedLimit> {
  const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
  const hit = limitCache.get(key);
  if (hit) return hit;
  let result: SpeedLimit = { speedLimitKmh: null, roadName: roadNameHint ?? null, source: 'unknown' };
  try {
    const q = `[out:json][timeout:5];way(around:25,${p.lat},${p.lng})[highway];out tags 5;`;
    const data = await fetchJson<{ elements: { tags?: Record<string, string> }[] }>(config.overpassUrl, {
      method: 'POST',
      body: new URLSearchParams({ data: q }),
      headers: { 'User-Agent': config.osmUserAgent },
    });
    const ways = data.elements.filter((e) => e.tags?.highway);
    const tagged = ways.find((w) => parseMaxspeed(w.tags!.maxspeed) != null);
    if (tagged) {
      result = { speedLimitKmh: parseMaxspeed(tagged.tags!.maxspeed), roadName: tagged.tags!.name ?? tagged.tags!.ref ?? null, source: 'osm-maxspeed' };
    } else if (ways.length) {
      const w = ways[0].tags!;
      const byName = speedLimitFromRoadName(w.name ?? w.ref ?? roadNameHint);
      result = byName
        ? { speedLimitKmh: byName, roadName: w.name ?? w.ref ?? null, source: 'road-name' }
        : { speedLimitKmh: ROAD_CLASS_DEFAULTS[w.highway] ?? null, roadName: w.name ?? w.ref ?? null, source: 'osm-road-class' };
    }
  } catch (err) {
    logger.debug({ err: (err as Error).message }, 'Overpass lookup failed');
    const byName = speedLimitFromRoadName(roadNameHint);
    if (byName) result = { speedLimitKmh: byName, roadName: roadNameHint ?? null, source: 'road-name' };
    // Don't cache failures for long: they may be transient.
    return result;
  }
  limitCache.set(key, result);
  return result;
}
