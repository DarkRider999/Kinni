import type { PoolClient } from 'pg';
import { query } from '../connection';
import type { PlannedRoute } from '../../services/types';
import { decodePolyline, simplifyPath, toLineStringWkt } from '../../utils/geo';

export async function insertRouteOptions(client: PoolClient, tripId: string, routes: PlannedRoute[]): Promise<void> {
  for (const r of routes) {
    const path = simplifyPath(decodePolyline(r.polyline), 1000);
    await client.query(
      `INSERT INTO route_options
         (trip_id, route_type, variant_key, summary, distance_km, duration_minutes, duration_p10_minutes,
          duration_p90_minutes, eta_confidence, toll_cost_aed, toll_gates, stress_score, congestion_level,
          school_zones, path, polyline, steps)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
               CASE WHEN $15::text IS NULL THEN NULL ELSE ST_GeogFromText($15) END, $16, $17)`,
      [
        tripId,
        r.routeType,
        r.variantKey,
        r.summary,
        r.distanceKm,
        r.durationMinutes,
        r.durationP10Minutes,
        r.durationP90Minutes,
        r.etaConfidence,
        r.tollCostAed,
        JSON.stringify(r.tollGates),
        r.stressScore,
        r.congestionLevel,
        JSON.stringify(r.schoolZones),
        path.length ? toLineStringWkt(path) : null,
        r.polyline,
        JSON.stringify(r.steps),
      ],
    );
  }
}

interface RouteOptionRow {
  route_type: PlannedRoute['routeType'];
  variant_key: string;
  summary: string;
  distance_km: number;
  duration_minutes: number;
  duration_p10_minutes: number;
  duration_p90_minutes: number;
  eta_confidence: number;
  toll_cost_aed: number;
  toll_gates: PlannedRoute['tollGates'];
  stress_score: number;
  congestion_level: string;
  school_zones: PlannedRoute['schoolZones'];
  polyline: string;
  steps: PlannedRoute['steps'];
}

export async function listRouteOptions(tripId: string): Promise<PlannedRoute[]> {
  const rows = await query<RouteOptionRow>(
    `SELECT route_type, variant_key, summary, distance_km::float, duration_minutes::float,
            duration_p10_minutes::float, duration_p90_minutes::float, eta_confidence::float,
            toll_cost_aed::float, toll_gates, stress_score::float, congestion_level, school_zones, polyline, steps
     FROM route_options WHERE trip_id = $1
     ORDER BY array_position(ARRAY['FASTEST','CHEAPEST','LOW_STRESS'], route_type)`,
    [tripId],
  );
  return rows.map((r) => ({
    routeType: r.route_type,
    variantKey: r.variant_key,
    summary: r.summary,
    distanceKm: r.distance_km,
    durationMinutes: r.duration_minutes,
    durationP10Minutes: r.duration_p10_minutes,
    durationP90Minutes: r.duration_p90_minutes,
    etaConfidence: r.eta_confidence,
    tollCostAed: r.toll_cost_aed,
    tollGates: r.toll_gates,
    stressScore: r.stress_score,
    congestionLevel: r.congestion_level,
    schoolZones: r.school_zones,
    polyline: r.polyline,
    steps: r.steps,
  }));
}
