/**
 * Events near a route around a given time. Sources:
 *  1. The `events` table (joined with `venues`) in Postgres.
 *  2. EVENTS_API_URL (optional): any JSON endpoint returning an array of
 *     { name, venue, lat, lng, starts_at, ends_at, expected_attendance }.
 */
import { config } from '../config';
import { query } from '../db/connection';
import { logger } from '../logger';
import { closestPointOnPath, type LatLng, simplifyPath, toLineStringWkt } from '../utils/geo';
import { fetchJson, TtlCache } from '../utils/http';
import type { NearbyEvent } from './types';

const EVENT_RADIUS_M = 3000;
const WINDOW_BEFORE_MIN = 180;
const WINDOW_AFTER_MIN = 120;

interface FeedEvent {
  name: string;
  venue?: string;
  lat: number;
  lng: number;
  starts_at: string;
  ends_at: string;
  expected_attendance?: number;
}

const feedCache = new TtlCache<FeedEvent[]>(15 * 60_000, 4);

async function feedEvents(): Promise<FeedEvent[]> {
  if (!config.eventsApiUrl) return [];
  const hit = feedCache.get('feed');
  if (hit) return hit;
  try {
    const data = await fetchJson<FeedEvent[] | { events: FeedEvent[] }>(config.eventsApiUrl);
    const events = (Array.isArray(data) ? data : data.events ?? []).filter(
      (e) => Number.isFinite(e.lat) && Number.isFinite(e.lng) && e.starts_at && e.ends_at,
    );
    feedCache.set('feed', events);
    return events;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Events feed unavailable');
    return [];
  }
}

function toNearby(name: string, venue: string, startsAt: Date, endsAt: Date, attendance: number, distanceKm: number, at: Date): NearbyEvent {
  return {
    name,
    venue,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    expectedAttendance: attendance,
    distanceKm: Math.round(distanceKm * 10) / 10,
    minutesToStart: Math.round((startsAt.getTime() - at.getTime()) / 60_000),
  };
}

export async function eventsNearRoute(path: LatLng[], at: Date): Promise<NearbyEvent[]> {
  const from = new Date(at.getTime() - WINDOW_AFTER_MIN * 60_000);
  const to = new Date(at.getTime() + WINDOW_BEFORE_MIN * 60_000);
  const results: NearbyEvent[] = [];

  try {
    const rows = await query<{ name: string; venue: string; starts_at: Date; ends_at: Date; expected_attendance: number; distance_m: number }>(
      `SELECT e.name, v.name AS venue, e.starts_at, e.ends_at, e.expected_attendance,
              ST_Distance(v.location, ST_GeogFromText($1)) AS distance_m
       FROM events e JOIN venues v ON v.id = e.venue_id
       WHERE e.starts_at <= $3 AND e.ends_at >= $2
         AND ST_DWithin(v.location, ST_GeogFromText($1), $4)
       ORDER BY e.starts_at LIMIT 10`,
      [toLineStringWkt(simplifyPath(path)), from, to, EVENT_RADIUS_M],
    );
    for (const r of rows) results.push(toNearby(r.name, r.venue, r.starts_at, r.ends_at, r.expected_attendance, r.distance_m / 1000, at));
  } catch (err) {
    logger.debug({ err: (err as Error).message }, 'Event lookup (db) failed');
  }

  for (const e of await feedEvents()) {
    const startsAt = new Date(e.starts_at);
    const endsAt = new Date(e.ends_at);
    if (startsAt > to || endsAt < from) continue;
    const { distanceM } = closestPointOnPath({ lat: e.lat, lng: e.lng }, path);
    if (distanceM > EVENT_RADIUS_M) continue;
    results.push(toNearby(e.name, e.venue ?? 'Venue', startsAt, endsAt, e.expected_attendance ?? 5000, distanceM / 1000, at));
  }
  return results;
}

export async function upcomingEvents(limit = 20) {
  return query(
    `SELECT e.id, e.name, v.name AS venue, v.emirate, ST_Y(v.location::geometry) AS lat, ST_X(v.location::geometry) AS lng,
            e.starts_at, e.ends_at, e.expected_attendance
     FROM events e JOIN venues v ON v.id = e.venue_id
     WHERE e.ends_at >= now() ORDER BY e.starts_at LIMIT $1`,
    [limit],
  );
}
