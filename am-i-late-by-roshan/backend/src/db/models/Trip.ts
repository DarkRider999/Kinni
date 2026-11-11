import { query, queryOne, withTransaction } from '../connection';
import type { PlanResult, RouteType } from '../../services/types';
import { insertRouteOptions, listRouteOptions } from './RouteOption';

export type TripStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface TripRow {
  id: string;
  user_id: string;
  origin: { lat: number; lng: number };
  origin_label: string | null;
  destination: { lat: number; lng: number };
  destination_label: string | null;
  target_arrival: Date | null;
  recommended_departure: Date | null;
  expected_arrival: Date | null;
  verdict: PlanResult['verdict'] | null;
  minutes_late: number | null;
  selected_route_type: RouteType | null;
  status: TripStatus;
  explanation: string | null;
  provider: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
}

const SELECT = `
  SELECT id, user_id,
         json_build_object('lat', ST_Y(origin::geometry), 'lng', ST_X(origin::geometry)) AS origin, origin_label,
         json_build_object('lat', ST_Y(destination::geometry), 'lng', ST_X(destination::geometry)) AS destination,
         destination_label, target_arrival, recommended_departure, expected_arrival, verdict,
         minutes_late::float AS minutes_late, selected_route_type, status, explanation, provider,
         started_at, completed_at, created_at
  FROM trips`;

export async function saveTripPlan(userId: string, plan: PlanResult): Promise<string> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO trips (user_id, origin, origin_label, destination, destination_label, target_arrival,
                          recommended_departure, expected_arrival, verdict, minutes_late, explanation, provider)
       VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4,
               ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        userId,
        plan.origin.lng,
        plan.origin.lat,
        plan.origin.label ?? null,
        plan.destination.lng,
        plan.destination.lat,
        plan.destination.label ?? null,
        plan.targetArrival,
        plan.recommendedDeparture,
        plan.expectedArrival,
        plan.verdict,
        plan.minutesLate,
        plan.explanation,
        plan.context.provider,
      ],
    );
    const tripId = rows[0].id;
    await insertRouteOptions(client, tripId, plan.routes);
    return tripId;
  });
}

export function listTrips(userId: string, limit = 20): Promise<TripRow[]> {
  return query<TripRow>(`${SELECT} WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`, [userId, limit]);
}

export function getTrip(userId: string, tripId: string): Promise<TripRow | null> {
  return queryOne<TripRow>(`${SELECT} WHERE user_id = $1 AND id = $2`, [userId, tripId]);
}

export async function getTripWithRoutes(userId: string, tripId: string) {
  const trip = await getTrip(userId, tripId);
  if (!trip) return null;
  return { ...trip, routes: await listRouteOptions(tripId) };
}

export async function updateTripStatus(
  userId: string,
  tripId: string,
  status: TripStatus,
  routeType?: RouteType,
): Promise<TripRow | null> {
  const row = await queryOne<{ id: string }>(
    `UPDATE trips SET status = $3,
       selected_route_type = COALESCE($4, selected_route_type),
       started_at = CASE WHEN $3 = 'IN_PROGRESS' THEN now() ELSE started_at END,
       completed_at = CASE WHEN $3 IN ('COMPLETED', 'CANCELLED') THEN now() ELSE completed_at END
     WHERE user_id = $1 AND id = $2 RETURNING id`,
    [userId, tripId, status, routeType ?? null],
  );
  return row ? getTrip(userId, tripId) : null;
}
