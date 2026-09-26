/**
 * Client for the Python AI service. Every call has a local fallback that mirrors
 * the service's heuristic models, so trip planning keeps working (with
 * aiSource = 'fallback') if the AI service is down or slow.
 */
import { config } from '../config';
import { logger } from '../logger';
import { emirateOf, type LatLng, uaeLocal } from '../utils/geo';
import { fetchJson } from '../utils/http';
import type { WeatherNow } from './types';

export interface TrafficForecast {
  congestion_factor: number;
  level: 'LOW' | 'MODERATE' | 'HEAVY' | 'SEVERE';
  peak_label: string;
  forecast: { departure_time: string; congestion_factor: number; level: string }[];
}

export interface EtaPrediction {
  eta_minutes: number;
  p10_minutes: number;
  p90_minutes: number;
  confidence: number;
  breakdown: Record<string, number>;
}

export interface DisruptionScore {
  score: number;
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  factors: string[];
}

export interface DriverState {
  fatigue_score: number;
  level: 'ALERT' | 'MILD' | 'TIRED' | 'DANGER';
  should_alert: boolean;
  recommendation: string;
}

export interface TrafficInput {
  origin: LatLng;
  destination: LatLng;
  departure_time: string;
  crowd_speed_ratio?: number | null;
}

export interface EtaInput {
  free_flow_minutes: number;
  distance_km: number;
  congestion_factor: number;
  traffic_aware_minutes?: number | null;
  weather: { condition: WeatherNow['condition']; visibility_km: number | null; rain_mm: number };
  disruption_score: number;
  school_zone_count: number;
  departure_time: string;
}

export interface DisruptionInput {
  weather: EtaInput['weather'];
  events: { expected_attendance: number; distance_km: number; minutes_to_start: number; minutes_to_end: number }[];
  school_zone_active: boolean;
  incident_count: number;
}

export interface DriverStateInput {
  continuous_drive_minutes: number;
  local_hour: number;
  steering_variance: number;
  harsh_event_count: number;
  speed_variance?: number;
  hours_slept?: number | null;
}

export interface AiClient {
  predictTraffic(input: TrafficInput): Promise<TrafficForecast>;
  predictEta(input: EtaInput): Promise<EtaPrediction>;
  scoreDisruption(input: DisruptionInput): Promise<DisruptionScore>;
  scoreDriverState(input: DriverStateInput): Promise<DriverState>;
  /** 'ai-service' if the last call reached the service, 'fallback' if it used local heuristics. */
  lastSource(): 'ai-service' | 'fallback';
}

// ------------------------------------------------------------------ local heuristics (mirror of ai-service/app/models)

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const bump = (h: number, center: number, width: number, height: number) => height * Math.exp(-(((h - center) / width) ** 2));
const round = (v: number, dp = 2) => Math.round(v * 10 ** dp) / 10 ** dp;

export function timeOfDayCongestion(minutesOfDay: number, isoDow: number): { extra: number; label: string } {
  const h = minutesOfDay / 60;
  let extra: number;
  if (isoDow <= 4) extra = bump(h, 7.75, 1.0, 0.85) + bump(h, 18.0, 1.4, 0.75) + bump(h, 14.25, 0.8, 0.25);
  else if (isoDow === 5) extra = bump(h, 7.75, 1.0, 0.8) + bump(h, 13.0, 1.0, 0.45) + bump(h, 18.5, 1.8, 0.55);
  else if (isoDow === 6) extra = bump(h, 12.5, 3.0, 0.25) + bump(h, 20.0, 2.2, 0.45);
  else extra = bump(h, 13.0, 3.0, 0.2) + bump(h, 19.5, 2.0, 0.4);
  const weekday = isoDow <= 5;
  const label =
    weekday && h >= 6.5 && h < 9.5
      ? 'morning peak'
      : weekday && h >= 16.5 && h < 20
        ? 'evening peak'
        : weekday && h >= 13.5 && h < 15
          ? 'school pick-up'
          : !weekday && h >= 18 && h < 23
            ? 'weekend evening'
            : h >= 22 || h < 6
              ? 'night'
              : 'off-peak';
  return { extra, label };
}

export function corridorMultiplier(origin: LatLng, destination: LatLng, minutesOfDay: number, isoDow: number): number {
  const from = emirateOf(origin);
  const to = emirateOf(destination);
  const h = minutesOfDay / 60;
  const weekday = isoDow <= 5;
  const northern = (e: string) => e === 'Sharjah' || e === 'Ajman' || e === 'Umm Al Quwain';
  if (weekday && northern(from) && to === 'Dubai' && h >= 5.5 && h < 10.5) return 1.6;
  if (weekday && from === 'Dubai' && northern(to) && h >= 16 && h < 21) return 1.6;
  if ((from === 'Abu Dhabi' && to === 'Dubai') || (from === 'Dubai' && to === 'Abu Dhabi')) return 0.8;
  return 1.0;
}

export const congestionLevel = (f: number): TrafficForecast['level'] => (f < 1.15 ? 'LOW' : f < 1.4 ? 'MODERATE' : f < 1.75 ? 'HEAVY' : 'SEVERE');

export function localTraffic(input: TrafficInput): TrafficForecast {
  const at = new Date(input.departure_time);
  const factorAt = (d: Date) => {
    const t = uaeLocal(d);
    const { extra } = timeOfDayCongestion(t.minutesOfDay, t.isoDow);
    let f = 1 + extra * corridorMultiplier(input.origin, input.destination, t.minutesOfDay, t.isoDow);
    if (input.crowd_speed_ratio != null && input.crowd_speed_ratio > 0) {
      const observed = 1 / clamp(input.crowd_speed_ratio, 0.2, 1.2);
      f = 0.6 * observed + 0.4 * f;
    }
    return round(clamp(f, 1, 3));
  };
  const t = uaeLocal(at);
  const factor = factorAt(at);
  const forecast = [-60, -45, -30, -15, 0, 15, 30, 45, 60].map((off) => {
    const d = new Date(at.getTime() + off * 60_000);
    const f = factorAt(d);
    return { departure_time: d.toISOString(), congestion_factor: f, level: congestionLevel(f) };
  });
  return { congestion_factor: factor, level: congestionLevel(factor), peak_label: timeOfDayCongestion(t.minutesOfDay, t.isoDow).label, forecast };
}

export function weatherFactor(w: EtaInput['weather']): number {
  switch (w.condition) {
    case 'RAIN':
      return 1.2 + Math.min(w.rain_mm, 20) * 0.01;
    case 'FOG':
      return w.visibility_km != null && w.visibility_km < 0.2 ? 1.45 : w.visibility_km != null && w.visibility_km < 1 ? 1.3 : 1.12;
    case 'SANDSTORM':
      return 1.35;
    case 'DUST':
      return 1.08;
    case 'HEAT':
      return 1.02;
    default:
      return 1.0;
  }
}

export function localEta(input: EtaInput): EtaPrediction {
  const wf = weatherFactor(input.weather);
  const trafficMin =
    input.traffic_aware_minutes != null ? Math.max(input.traffic_aware_minutes, input.free_flow_minutes) : input.free_flow_minutes * input.congestion_factor;
  const disruptionMult = 1 + (clamp(input.disruption_score, 0, 100) / 100) * 0.25;
  const schoolDelay = input.school_zone_count * 1.5;
  const eta = trafficMin * wf * disruptionMult + schoolDelay;
  const sigma = clamp(0.06 + 0.12 * (input.congestion_factor - 1) + (wf - 1) * 0.5 + (input.disruption_score / 100) * 0.15, 0.05, 0.45);
  return {
    eta_minutes: round(eta, 1),
    p10_minutes: round(Math.max(input.free_flow_minutes * 0.95, eta * (1 - 1.2816 * sigma * 0.8)), 1),
    p90_minutes: round(eta * (1 + 1.2816 * sigma), 1),
    confidence: round(clamp(1 - sigma * 1.5, 0.3, 0.97)),
    breakdown: {
      base_minutes: round(input.free_flow_minutes, 1),
      traffic_minutes: round(trafficMin - input.free_flow_minutes, 1),
      weather_minutes: round(trafficMin * (wf - 1), 1),
      disruption_minutes: round(trafficMin * wf * (disruptionMult - 1), 1),
      school_zone_minutes: round(schoolDelay, 1),
    },
  };
}

const WEATHER_DISRUPTION: Record<string, [number, string]> = {
  RAIN: [20, 'Rain: slippery roads and possible flooding'],
  FOG: [25, 'Fog: reduced visibility'],
  SANDSTORM: [35, 'Sandstorm: very low visibility'],
  DUST: [12, 'Dust: reduced visibility'],
  HEAT: [3, 'Extreme heat'],
};

export function localDisruption(input: DisruptionInput): DisruptionScore {
  let score = 0;
  const factors: string[] = [];
  const w = WEATHER_DISRUPTION[input.weather.condition];
  if (w) {
    let s = w[0];
    if (input.weather.condition === 'RAIN') s += Math.min(input.weather.rain_mm, 20);
    score += s;
    factors.push(w[1]);
  }
  for (const e of input.events) {
    const size = Math.min(e.expected_attendance / 20000, 1.5) * 25;
    const proximity = Math.max(0, 1 - e.distance_km / 5);
    let timing = 0;
    if (e.minutes_to_start >= 0 && e.minutes_to_start <= 120) timing = 1 - e.minutes_to_start / 180;
    else if (e.minutes_to_start < 0 && e.minutes_to_end > 0) timing = 0.3;
    else if (e.minutes_to_end <= 0 && e.minutes_to_end >= -45) timing = 0.9;
    const s = size * proximity * timing;
    if (s >= 1) {
      score += s;
      factors.push(`Event traffic (${e.expected_attendance.toLocaleString('en')} expected, ${e.distance_km.toFixed(1)} km from route)`);
    }
  }
  if (input.school_zone_active) {
    score += 10;
    factors.push('Active school zone on route');
  }
  if (input.incident_count > 0) {
    score += Math.min(input.incident_count * 15, 30);
    factors.push(`${input.incident_count} reported incident(s)`);
  }
  score = round(clamp(score, 0, 100), 1);
  const level = score < 20 ? 'LOW' : score < 45 ? 'MODERATE' : score < 70 ? 'HIGH' : 'SEVERE';
  return { score, level, factors };
}

export function localDriverState(input: DriverStateInput): DriverState {
  const timeOnTask = Math.min(input.continuous_drive_minutes / 240, 1) * 40;
  const h = input.local_hour;
  const circadian = h >= 2 && h < 6 ? 25 : h >= 0 && h < 2 ? 15 : h >= 14 && h < 16 ? 10 : h >= 22 ? 8 : 0;
  const steering = clamp(input.steering_variance / 0.5, 0, 1) * 20;
  const harsh = Math.min(input.harsh_event_count * 5, 15);
  const sleep = input.hours_slept != null && input.hours_slept < 6 ? Math.min((6 - input.hours_slept) * 5, 20) : 0;
  const score = round(clamp(timeOnTask + circadian + steering + harsh + sleep, 0, 100), 1);
  const level = score < 30 ? 'ALERT' : score < 50 ? 'MILD' : score < 70 ? 'TIRED' : 'DANGER';
  const recommendation =
    level === 'DANGER'
      ? 'Pull over safely now and rest. Consider a 20-minute nap before continuing.'
      : level === 'TIRED'
        ? 'Signs of fatigue detected. Take a break at the next petrol station or rest area.'
        : level === 'MILD'
          ? 'Stay hydrated and plan a break within the next 30 minutes.'
          : 'You seem alert. Drive safely.';
  return { fatigue_score: score, level, should_alert: score >= 60, recommendation };
}

// ------------------------------------------------------------------ HTTP client

export function createAiClient(baseUrl = config.aiServiceUrl, timeoutMs = config.aiTimeoutMs): AiClient {
  let source: 'ai-service' | 'fallback' = 'ai-service';
  let lastWarn = 0;

  async function call<I, O>(path: string, body: I, fallback: (i: I) => O): Promise<O> {
    try {
      const out = await fetchJson<O>(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        timeoutMs,
        external: false,
      });
      source = 'ai-service';
      return out;
    } catch (err) {
      source = 'fallback';
      if (Date.now() - lastWarn > 60_000) {
        lastWarn = Date.now();
        logger.warn({ err: (err as Error).message, path }, 'AI service unreachable; using local heuristics');
      }
      return fallback(body);
    }
  }

  return {
    predictTraffic: (i) => call('/predict/traffic', i, localTraffic),
    predictEta: (i) => call('/predict/eta', i, localEta),
    scoreDisruption: (i) => call('/score/disruption', i, localDisruption),
    scoreDriverState: (i) => call('/score/driver-state', i, localDriverState),
    lastSource: () => source,
  };
}

/** Pure-local client (tests, or AI_SERVICE_URL=local). */
export function createLocalAiClient(): AiClient {
  return {
    predictTraffic: async (i) => localTraffic(i),
    predictEta: async (i) => localEta(i),
    scoreDisruption: async (i) => localDisruption(i),
    scoreDriverState: async (i) => localDriverState(i),
    lastSource: () => 'fallback',
  };
}

let shared: AiClient | null = null;
export function getAiClient(): AiClient {
  if (!shared) shared = config.aiServiceUrl === 'local' ? createLocalAiClient() : createAiClient();
  return shared;
}
