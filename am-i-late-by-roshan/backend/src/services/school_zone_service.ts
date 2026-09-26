/** School zones intersecting a route while the zone is active (school days, AM/PM windows). */
import { query } from '../db/connection';
import { logger } from '../logger';
import { type LatLng, simplifyPath, toLineStringWkt, uaeLocal } from '../utils/geo';
import type { SchoolZoneHit } from './types';

export async function schoolZonesOnRoute(path: LatLng[], at: Date, opts: { activeOnly?: boolean } = {}): Promise<SchoolZoneHit[]> {
  if (path.length === 0) return [];
  const local = uaeLocal(at);
  const clock = `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`;
  try {
    const rows = await query<{ id: number; name: string; am_start: string; am_end: string; pm_start: string; pm_end: string; is_sample: boolean; active: boolean }>(
      `SELECT id, name, to_char(am_start,'HH24:MI') AS am_start, to_char(am_end,'HH24:MI') AS am_end,
              to_char(pm_start,'HH24:MI') AS pm_start, to_char(pm_end,'HH24:MI') AS pm_end, is_sample,
              ($2 = ANY(school_days) AND (($3::time BETWEEN am_start AND am_end) OR ($3::time BETWEEN pm_start AND pm_end))) AS active
       FROM school_zones
       WHERE ST_Intersects(zone, ST_GeogFromText($1))`,
      [toLineStringWkt(simplifyPath(path)), local.isoDow, clock],
    );
    return rows
      .filter((r) => !(opts.activeOnly ?? true) || r.active)
      .map((r) => ({ id: r.id, name: r.name, window: `${r.am_start}-${r.am_end}, ${r.pm_start}-${r.pm_end}`, isSample: r.is_sample }));
  } catch (err) {
    logger.debug({ err: (err as Error).message }, 'School zone lookup failed');
    return [];
  }
}

/** True when the route crosses at least one school zone that is active at `at`. */
export async function routeMayPassSchoolZone(path: LatLng[], at: Date): Promise<boolean> {
  return (await schoolZonesOnRoute(path, at)).length > 0;
}
