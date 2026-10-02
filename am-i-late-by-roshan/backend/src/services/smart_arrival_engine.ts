/**
 * Smart Arrival Engine: answers "Am I late?" for a trip.
 *
 * 1. Fetch real road alternatives from the Directions provider.
 * 2. Gather context: weather, events near each route, active school zones.
 * 3. Ask the AI service for congestion, disruption and a per-route ETA with
 *    an uncertainty band, iterating the departure time so the forecast is for
 *    when you'll actually leave.
 * 4. Pick FASTEST / CHEAPEST (Salik/DARB) / LOW_STRESS, work out the verdict
 *    and recommended departure, and explain it in plain language.
 */
import { formatUaeTime, type LatLng } from '../utils/geo';
import type { AiClient, EtaPrediction, TrafficForecast } from './ai_client';
import type { DirectionsOptions, DirectionsRoute } from './directions_service';
import { estimateTolls, type TollEstimate } from './toll_service';
import type { NearbyEvent, Place, PlannedRoute, PlanResult, RouteType, SchoolZoneHit, Verdict, WeatherNow } from './types';

export interface EngineDeps {
  directions: (origin: LatLng, destination: LatLng, opts: DirectionsOptions) => Promise<DirectionsRoute[]>;
  weather: (p: LatLng) => Promise<WeatherNow>;
  events: (path: LatLng[], at: Date) => Promise<NearbyEvent[]>;
  schoolZones: (path: LatLng[], at: Date) => Promise<SchoolZoneHit[]>;
  crowdSpeedRatio?: (p: LatLng) => Promise<number | null>;
  ai: AiClient;
}

export interface PlanInput {
  origin: Place;
  destination: Place;
  /** Arrive-by time. When omitted, the plan is for leaving at `departAt` (default: now). */
  targetArrival?: Date | null;
  departAt?: Date | null;
  bufferMinutes?: number;
  now?: Date;
}

/** Leave within this many minutes of now counts as "leave now". */
export const LEAVE_NOW_WINDOW_MIN = 5;
const MAX_ITERATIONS = 3;

interface Candidate {
  route: DirectionsRoute;
  key: string;
  eta: EtaPrediction;
  tolls: TollEstimate;
  schoolZones: SchoolZoneHit[];
  events: NearbyEvent[];
  stress: number;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

/** 0-100: congestion, turn density, active school zones and disruption all make a drive more stressful. */
export function stressScore(route: DirectionsRoute, congestion: number, schoolZoneCount: number, disruption: number): number {
  const turns = route.steps.filter((s) => !['depart', 'arrive', 'continue', 'new name'].includes(s.maneuver)).length;
  const turnsPerKm = turns / Math.max(route.distanceKm, 1);
  const score = Math.min(40, (congestion - 1) * 50) + Math.min(30, turnsPerKm * 20) + schoolZoneCount * 6 + disruption * 0.2;
  return Math.round(Math.max(0, Math.min(100, score)));
}

/** Travel time to plan around: the ETA plus the larger of the user's buffer and half the uncertainty band. */
export function safeTravelMinutes(eta: EtaPrediction, bufferMinutes: number): number {
  return eta.eta_minutes + Math.max(bufferMinutes, (eta.p90_minutes - eta.eta_minutes) * 0.5);
}

export function computeVerdict(args: {
  now: Date;
  targetArrival: Date | null;
  etaNowMinutes: number;
  recommendedDeparture: Date;
}): { verdict: Verdict; minutesLate: number; minutesUntilDeparture: number | null } {
  const { now, targetArrival, etaNowMinutes, recommendedDeparture } = args;
  if (!targetArrival) return { verdict: 'NO_TARGET', minutesLate: 0, minutesUntilDeparture: null };
  const arrivalIfLeavingNow = addMinutes(now, etaNowMinutes);
  const lateBy = (arrivalIfLeavingNow.getTime() - targetArrival.getTime()) / 60_000;
  const untilDeparture = Math.round((recommendedDeparture.getTime() - now.getTime()) / 60_000);
  if (lateBy > 0) return { verdict: 'LATE', minutesLate: Math.ceil(lateBy), minutesUntilDeparture: untilDeparture };
  if (untilDeparture <= LEAVE_NOW_WINDOW_MIN) return { verdict: 'LEAVE_NOW', minutesLate: 0, minutesUntilDeparture: Math.max(0, untilDeparture) };
  return { verdict: 'ON_TIME', minutesLate: 0, minutesUntilDeparture: untilDeparture };
}

export function buildExplanation(args: {
  verdict: Verdict;
  minutesLate: number;
  minutesUntilDeparture: number | null;
  recommendedDeparture: Date;
  expectedArrival: Date;
  targetArrival: Date | null;
  fastest: PlannedRoute;
  cheapest: PlannedRoute;
  traffic: Pick<TrafficForecast, 'level' | 'peak_label'>;
  weather: WeatherNow;
  events: NearbyEvent[];
  etaBreakdown?: Record<string, number>;
}): string {
  const { fastest, cheapest, traffic, weather, events } = args;
  const parts: string[] = [];
  const dep = formatUaeTime(args.recommendedDeparture);
  const arr = formatUaeTime(args.expectedArrival);
  switch (args.verdict) {
    case 'LATE':
      parts.push(
        `You're running late: leaving now gets you there about ${args.minutesLate} min after ${formatUaeTime(args.targetArrival!)}.`,
      );
      break;
    case 'LEAVE_NOW':
      parts.push(`Leave now to arrive by ${formatUaeTime(args.targetArrival!)}.`);
      break;
    case 'ON_TIME':
      parts.push(`You're on time. Leave by ${dep} (in ${args.minutesUntilDeparture} min) to arrive by ${formatUaeTime(args.targetArrival!)}.`);
      break;
    default:
      parts.push(`Leaving at ${dep}, you should arrive around ${arr}.`);
  }
  parts.push(
    `Fastest is ${fastest.summary}: about ${Math.round(fastest.durationMinutes)} min (${Math.round(fastest.durationP10Minutes)}-${Math.round(fastest.durationP90Minutes)} min), ${fastest.distanceKm.toFixed(1)} km.`,
  );
  const levelText: Record<string, string> = { LOW: 'light', MODERATE: 'moderate', HEAVY: 'heavy', SEVERE: 'severe' };
  parts.push(`Traffic looks ${levelText[traffic.level] ?? traffic.level.toLowerCase()} (${traffic.peak_label}).`);
  if (!['CLEAR', 'CLOUDY'].includes(weather.condition)) {
    const extra = args.etaBreakdown?.weather_minutes;
    parts.push(`${weather.description}${extra && extra >= 1 ? ` may add about ${Math.round(extra)} min` : ''}; drive carefully.`);
  }
  if (fastest.tollCostAed > 0) {
    const gates = fastest.tollGates.filter((g) => g.feeAed > 0).map((g) => g.name);
    parts.push(`Tolls: AED ${fastest.tollCostAed} (${gates.join(', ')}).`);
    if (cheapest.variantKey !== fastest.variantKey && cheapest.tollCostAed < fastest.tollCostAed) {
      const extraMin = Math.round(cheapest.durationMinutes - fastest.durationMinutes);
      parts.push(
        `Save AED ${fastest.tollCostAed - cheapest.tollCostAed} ${cheapest.summary}${extraMin > 0 ? ` for about ${extraMin} extra min` : ''}.`,
      );
    }
  }
  if (fastest.schoolZones.length) parts.push(`Active school zone on the way (${fastest.schoolZones[0].name}); expect slower traffic.`);
  if (events.length) {
    const e = events[0];
    parts.push(`${e.name} at ${e.venue} (${formatUaeTime(new Date(e.startsAt))}) may add congestion nearby.`);
  }
  return parts.join(' ');
}

function toPlanned(c: Candidate, routeType: RouteType, congestionLevel: string): PlannedRoute {
  return {
    routeType,
    variantKey: c.key,
    summary: c.route.summary,
    distanceKm: round1(c.route.distanceKm),
    durationMinutes: round1(c.eta.eta_minutes),
    durationP10Minutes: round1(c.eta.p10_minutes),
    durationP90Minutes: round1(c.eta.p90_minutes),
    etaConfidence: c.eta.confidence,
    tollCostAed: c.tolls.totalAed,
    tollGates: c.tolls.crossings,
    stressScore: c.stress,
    congestionLevel,
    schoolZones: c.schoolZones,
    polyline: c.route.polyline,
    steps: c.route.steps,
  };
}

const argmin = <T>(items: T[], key: (t: T) => number[]): T =>
  items.reduce((best, item) => {
    const a = key(item);
    const b = key(best);
    for (let i = 0; i < a.length; i++) {
      if (a[i] < b[i]) return item;
      if (a[i] > b[i]) return best;
    }
    return best;
  });

export function createSmartArrivalEngine(deps: EngineDeps) {
  async function evaluate(
    routes: DirectionsRoute[],
    input: PlanInput,
    departure: Date,
    weather: WeatherNow,
    crowdRatio: number | null,
  ) {
    const now = input.now ?? new Date();
    const traffic = await deps.ai.predictTraffic({
      origin: input.origin,
      destination: input.destination,
      departure_time: departure.toISOString(),
      crowd_speed_ratio: Math.abs(departure.getTime() - now.getTime()) < 20 * 60_000 ? crowdRatio : null,
    });
    const weatherIn = { condition: weather.condition, visibility_km: weather.visibilityKm, rain_mm: weather.rainMm };

    const candidates: Candidate[] = [];
    let worstDisruption = { score: 0, level: 'LOW', factors: [] as string[] };
    for (const [i, route] of routes.entries()) {
      const [schoolZones, events] = await Promise.all([deps.schoolZones(route.path, departure), deps.events(route.path, departure)]);
      const disruption = await deps.ai.scoreDisruption({
        weather: weatherIn,
        events: events.map((e) => ({
          expected_attendance: e.expectedAttendance,
          distance_km: e.distanceKm,
          minutes_to_start: e.minutesToStart,
          minutes_to_end: Math.round((new Date(e.endsAt).getTime() - departure.getTime()) / 60_000),
        })),
        school_zone_active: schoolZones.length > 0,
        incident_count: 0,
      });
      if (disruption.score >= worstDisruption.score) worstDisruption = disruption;
      // Provider traffic durations are only meaningful for "leave now"-ish departures.
      const trafficAware =
        route.trafficMinutes != null && Math.abs(departure.getTime() - now.getTime()) < 30 * 60_000 ? route.trafficMinutes : null;
      const eta = await deps.ai.predictEta({
        free_flow_minutes: route.freeFlowMinutes,
        distance_km: route.distanceKm,
        congestion_factor: traffic.congestion_factor,
        traffic_aware_minutes: trafficAware,
        weather: weatherIn,
        disruption_score: disruption.score,
        school_zone_count: schoolZones.length,
        departure_time: departure.toISOString(),
      });
      const tolls = estimateTolls(route.path, departure, eta.eta_minutes);
      candidates.push({
        route,
        key: `r${i}`,
        eta,
        tolls,
        schoolZones,
        events,
        stress: stressScore(route, traffic.congestion_factor, schoolZones.length, disruption.score),
      });
    }
    return { traffic, candidates, disruption: worstDisruption };
  }

  async function plan(input: PlanInput): Promise<PlanResult> {
    const now = input.now ?? new Date();
    const buffer = input.bufferMinutes ?? 5;
    const target = input.targetArrival ?? null;

    const firstGuessDeparture = input.departAt ?? now;
    const [routes, weather, crowdRatio] = await Promise.all([
      deps.directions(input.origin, input.destination, { departure: firstGuessDeparture, alternatives: true }),
      deps.weather(input.origin),
      deps.crowdSpeedRatio ? deps.crowdSpeedRatio(input.origin) : Promise.resolve(null),
    ]);
    if (!routes.length) throw new Error('No route found');

    // Iterate: departure depends on ETA, ETA depends on departure-time traffic.
    let departure = target ? addMinutes(target, -(routes[0].freeFlowMinutes * 1.3 + buffer)) : firstGuessDeparture;
    let evaluation = await evaluate(routes, input, departure, weather, crowdRatio);
    if (target) {
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const fastest = argmin(evaluation.candidates, (c) => [c.eta.eta_minutes]);
        const next = addMinutes(target, -safeTravelMinutes(fastest.eta, buffer));
        const moved = Math.abs(next.getTime() - departure.getTime()) / 60_000;
        departure = next;
        if (moved < 1) break;
        evaluation = await evaluate(routes, input, departure, weather, crowdRatio);
      }
    }

    const { candidates, traffic, disruption } = evaluation;
    const fastest = argmin(candidates, (c) => [c.eta.eta_minutes]);
    const cheapest = argmin(candidates, (c) => [c.tolls.totalAed, c.eta.eta_minutes]);
    const lowStress = argmin(candidates, (c) => [c.stress, c.eta.eta_minutes]);

    let recommendedDeparture = target ? addMinutes(target, -safeTravelMinutes(fastest.eta, buffer)) : departure;
    // ETA if leaving right now (differs from the recommended-departure ETA when traffic changes by time of day).
    let etaNowMinutes = fastest.eta.eta_minutes;
    if (target && Math.abs(departure.getTime() - now.getTime()) > 5 * 60_000) {
      const nowEval = await evaluate([fastest.route], input, now, weather, crowdRatio);
      etaNowMinutes = nowEval.candidates[0].eta.eta_minutes;
    }
    if (target && recommendedDeparture < now) recommendedDeparture = now;

    const verdict = computeVerdict({ now, targetArrival: target, etaNowMinutes, recommendedDeparture });
    const effectiveDeparture = verdict.verdict === 'LATE' ? now : recommendedDeparture;
    const expectedArrival = addMinutes(effectiveDeparture, verdict.verdict === 'LATE' ? etaNowMinutes : fastest.eta.eta_minutes);

    const routesOut = [
      toPlanned(fastest, 'FASTEST', traffic.level),
      toPlanned(cheapest, 'CHEAPEST', traffic.level),
      toPlanned(lowStress, 'LOW_STRESS', traffic.level),
    ];
    const events = candidates.flatMap((c) => c.events).filter((e, i, arr) => arr.findIndex((x) => x.name === e.name) === i);

    return {
      origin: input.origin,
      destination: input.destination,
      verdict: verdict.verdict,
      minutesLate: verdict.minutesLate,
      minutesUntilDeparture: verdict.minutesUntilDeparture,
      targetArrival: target ? target.toISOString() : null,
      recommendedDeparture: recommendedDeparture.toISOString(),
      expectedArrival: expectedArrival.toISOString(),
      explanation: buildExplanation({
        verdict: verdict.verdict,
        minutesLate: verdict.minutesLate,
        minutesUntilDeparture: verdict.minutesUntilDeparture,
        recommendedDeparture,
        expectedArrival,
        targetArrival: target,
        fastest: routesOut[0],
        cheapest: routesOut[1],
        traffic,
        weather,
        events,
        etaBreakdown: fastest.eta.breakdown,
      }),
      routes: routesOut,
      context: {
        weather,
        events,
        disruption,
        congestionLevel: traffic.level,
        provider: routes[0].provider,
        aiSource: deps.ai.lastSource(),
      },
    };
  }

  return { plan };
}

export type SmartArrivalEngine = ReturnType<typeof createSmartArrivalEngine>;
