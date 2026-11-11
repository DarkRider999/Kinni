import type { LatLng } from '../utils/geo';

export type RouteType = 'FASTEST' | 'CHEAPEST' | 'LOW_STRESS';
export const ROUTE_TYPES: RouteType[] = ['FASTEST', 'CHEAPEST', 'LOW_STRESS'];

export type Verdict = 'ON_TIME' | 'LEAVE_NOW' | 'LATE' | 'NO_TARGET';

export interface Place extends LatLng {
  label?: string | null;
}

export interface Lane {
  indications: string[];
  valid: boolean;
}

export interface RouteStep {
  instruction: string;
  maneuver: string;
  modifier: string | null;
  roadName: string;
  distanceM: number;
  durationS: number;
  location: LatLng;
  lanes: Lane[];
  laneGuidance: string | null;
}

export interface TollCrossing {
  gateId: string;
  name: string;
  system: 'SALIK' | 'DARB';
  feeAed: number;
  lat: number;
  lng: number;
}

export interface SchoolZoneHit {
  id: number;
  name: string;
  window: string;
  isSample: boolean;
}

export interface NearbyEvent {
  name: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  expectedAttendance: number;
  distanceKm: number;
  minutesToStart: number;
}

export type WeatherCondition = 'CLEAR' | 'CLOUDY' | 'RAIN' | 'FOG' | 'DUST' | 'SANDSTORM' | 'HEAT';

export interface WeatherNow {
  condition: WeatherCondition;
  temperatureC: number | null;
  visibilityKm: number | null;
  rainMm: number;
  windKmh: number | null;
  description: string;
  source: string;
}

export interface PlannedRoute {
  routeType: RouteType;
  /** Identifies the underlying physical route, so the UI can tell when e.g. CHEAPEST is the same road as FASTEST. */
  variantKey: string;
  summary: string;
  distanceKm: number;
  durationMinutes: number;
  durationP10Minutes: number;
  durationP90Minutes: number;
  etaConfidence: number;
  tollCostAed: number;
  tollGates: TollCrossing[];
  stressScore: number;
  congestionLevel: string;
  schoolZones: SchoolZoneHit[];
  polyline: string;
  steps: RouteStep[];
}

export interface PlanResult {
  tripId?: string;
  origin: Place;
  destination: Place;
  verdict: Verdict;
  minutesLate: number;
  minutesUntilDeparture: number | null;
  targetArrival: string | null;
  recommendedDeparture: string;
  expectedArrival: string;
  explanation: string;
  routes: PlannedRoute[];
  context: {
    weather: WeatherNow;
    events: NearbyEvent[];
    disruption: { score: number; level: string; factors: string[] };
    congestionLevel: string;
    provider: string;
    aiSource: 'ai-service' | 'fallback';
  };
}
