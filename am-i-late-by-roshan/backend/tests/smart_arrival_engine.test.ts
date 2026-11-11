import { describe, expect, it } from 'vitest';
import { createAiClient, createLocalAiClient, localEta } from '../src/services/ai_client';
import type { DirectionsRoute } from '../src/services/directions_service';
import { buildExplanation, computeVerdict, createSmartArrivalEngine, type EngineDeps, safeTravelMinutes } from '../src/services/smart_arrival_engine';
import { TOLL_GATES } from '../src/services/toll_service';
import type { WeatherNow } from '../src/services/types';
import { encodePolyline, type LatLng } from '../src/utils/geo';

const origin = { lat: 25.2, lng: 55.4, label: 'Home' };
const destination = { lat: 25.25, lng: 55.33, label: 'Office' };
const clear: WeatherNow = { condition: 'CLEAR', temperatureC: 30, visibilityKm: 10, rainMm: 0, windKmh: 10, description: 'Clear skies', source: 'test' };

function route(summary: string, minutes: number, km: number, path: LatLng[]): DirectionsRoute {
  return {
    provider: 'osrm',
    summary,
    distanceKm: km,
    freeFlowMinutes: minutes,
    trafficMinutes: null,
    path,
    polyline: encodePolyline(path),
    steps: [
      { instruction: 'Head north', maneuver: 'depart', modifier: null, roadName: 'A', distanceM: 1000, durationS: 60, location: path[0], lanes: [], laneGuidance: null },
      { instruction: 'Arrive', maneuver: 'arrive', modifier: null, roadName: '', distanceM: 0, durationS: 0, location: path.at(-1)!, lanes: [], laneGuidance: null },
    ],
    avoidsTolls: false,
  };
}

const garhoud = TOLL_GATES.find((g) => g.id === 'SALIK_AL_GARHOUD')!;
// Fast route through a Salik gate, slower toll-free detour.
const tolled = route('via Al Garhoud Bridge', 20, 22, [origin, { lat: garhoud.lat - 0.001, lng: garhoud.lng }, { lat: garhoud.lat + 0.001, lng: garhoud.lng }, destination]);
const tollFree = route('via Ras Al Khor Road', 26, 27, [origin, { lat: 25.3, lng: 55.45 }, destination]);

function engine(overrides: Partial<EngineDeps> = {}) {
  return createSmartArrivalEngine({
    directions: async () => [tolled, tollFree],
    weather: async () => clear,
    events: async () => [],
    schoolZones: async () => [],
    ai: createLocalAiClient(),
    ...overrides,
  });
}

// Monday 2026-09-28, 03:00 UAE: free-flow night traffic, Salik free.
const NIGHT = new Date('2026-09-28T03:00:00+04:00');
// Monday 2026-09-28, 07:30 UAE: morning peak.
const MORNING = new Date('2026-09-28T07:30:00+04:00');
const plusMin = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

describe('computeVerdict', () => {
  const now = new Date('2026-09-28T07:00:00+04:00');
  it('is LATE when leaving now misses the target', () => {
    expect(computeVerdict({ now, targetArrival: plusMin(now, 20), etaNowMinutes: 30, recommendedDeparture: now })).toEqual({
      verdict: 'LATE',
      minutesLate: 10,
      minutesUntilDeparture: 0,
    });
  });
  it('is LEAVE_NOW within the 5-minute window', () => {
    expect(computeVerdict({ now, targetArrival: plusMin(now, 40), etaNowMinutes: 30, recommendedDeparture: plusMin(now, 3) }).verdict).toBe('LEAVE_NOW');
  });
  it('is ON_TIME with the minutes left before leaving', () => {
    expect(computeVerdict({ now, targetArrival: plusMin(now, 90), etaNowMinutes: 30, recommendedDeparture: plusMin(now, 50) })).toMatchObject({
      verdict: 'ON_TIME',
      minutesUntilDeparture: 50,
    });
  });
  it('is NO_TARGET without an arrival time', () => {
    expect(computeVerdict({ now, targetArrival: null, etaNowMinutes: 30, recommendedDeparture: now }).verdict).toBe('NO_TARGET');
  });
});

describe('safeTravelMinutes', () => {
  it('uses the larger of the buffer and half the uncertainty band', () => {
    const eta = { eta_minutes: 30, p10_minutes: 27, p90_minutes: 50, confidence: 0.7, breakdown: {} };
    expect(safeTravelMinutes(eta, 5)).toBe(40);
    expect(safeTravelMinutes(eta, 15)).toBe(45);
  });
});

describe('SmartArrivalEngine.plan', () => {
  it('picks fastest vs cheapest (Salik) and explains the trade-off', async () => {
    const plan = await engine().plan({ origin, destination, targetArrival: plusMin(MORNING, 120), now: MORNING });
    const [fastest, cheapest, lowStress] = plan.routes;
    expect(fastest.routeType).toBe('FASTEST');
    expect(fastest.summary).toBe('via Al Garhoud Bridge');
    expect(fastest.tollCostAed).toBe(6);
    expect(cheapest.summary).toBe('via Ras Al Khor Road');
    expect(cheapest.tollCostAed).toBe(0);
    expect(lowStress.routeType).toBe('LOW_STRESS');
    expect(plan.verdict).toBe('ON_TIME');
    expect(plan.explanation).toMatch(/Tolls: AED 6 \(Al Garhoud Bridge\)/);
    expect(plan.explanation).toMatch(/Save AED 6 via Ras Al Khor Road/);
  });

  it('recommends leaving earlier than target minus free-flow at peak time', async () => {
    const target = new Date('2026-09-28T08:30:00+04:00');
    const plan = await engine().plan({ origin, destination, targetArrival: target, now: new Date('2026-09-28T06:00:00+04:00') });
    const leaveBy = new Date(plan.recommendedDeparture);
    const minutesBefore = (target.getTime() - leaveBy.getTime()) / 60_000;
    expect(minutesBefore).toBeGreaterThan(30); // 20 min free-flow, peak congestion + buffer
    expect(plan.routes[0].durationMinutes).toBeGreaterThan(28);
    expect(plan.context.congestionLevel).toMatch(/HEAVY|SEVERE/);
  });

  it('says LATE when the target is too close', async () => {
    const plan = await engine().plan({ origin, destination, targetArrival: plusMin(NIGHT, 10), now: NIGHT });
    expect(plan.verdict).toBe('LATE');
    expect(plan.minutesLate).toBeGreaterThanOrEqual(10);
    expect(plan.explanation).toMatch(/running late/);
    expect(new Date(plan.recommendedDeparture).getTime()).toBe(NIGHT.getTime());
  });

  it('plans a departure-time trip without a target', async () => {
    const plan = await engine().plan({ origin, destination, departAt: NIGHT, now: NIGHT });
    expect(plan.verdict).toBe('NO_TARGET');
    expect(plan.routes[0].tollCostAed).toBe(0); // Salik is free 01:00-06:00
    expect(new Date(plan.expectedArrival).getTime()).toBeGreaterThan(NIGHT.getTime());
  });

  it('accounts for weather, school zones and events', async () => {
    const plan = await engine({
      weather: async () => ({ ...clear, condition: 'RAIN', rainMm: 5, description: 'Rain' }),
      schoolZones: async () => [{ id: 1, name: 'Test school', window: '06:45-08:15, 13:30-15:30', isSample: true }],
      events: async (_p, at) => [
        { name: 'Big Concert', venue: 'Coca-Cola Arena', startsAt: plusMin(at, 30).toISOString(), endsAt: plusMin(at, 200).toISOString(), expectedAttendance: 17000, distanceKm: 0.5, minutesToStart: 30 },
      ],
    }).plan({ origin, destination, departAt: NIGHT, now: NIGHT });
    expect(plan.explanation).toMatch(/Rain/);
    expect(plan.explanation).toMatch(/school zone/);
    expect(plan.explanation).toMatch(/Big Concert at Coca-Cola Arena/);
    expect(plan.context.disruption.score).toBeGreaterThan(30);
    expect(plan.routes[0].durationMinutes).toBeGreaterThan(20 * 1.25);
  });

  it('uses provider traffic durations for leave-now trips', async () => {
    const withTraffic = { ...tolled, trafficMinutes: 33 };
    const plan = await engine({ directions: async () => [withTraffic] }).plan({ origin, destination, departAt: NIGHT, now: NIGHT });
    expect(plan.routes[0].durationMinutes).toBe(33);
  });
});

describe('buildExplanation', () => {
  it('never mentions tolls on a toll-free route', () => {
    const r = {
      routeType: 'FASTEST' as const,
      variantKey: 'r0',
      summary: 'via E311',
      distanceKm: 10,
      durationMinutes: 12,
      durationP10Minutes: 11,
      durationP90Minutes: 14,
      etaConfidence: 0.9,
      tollCostAed: 0,
      tollGates: [],
      stressScore: 10,
      congestionLevel: 'LOW',
      schoolZones: [],
      polyline: '',
      steps: [],
    };
    const text = buildExplanation({
      verdict: 'NO_TARGET',
      minutesLate: 0,
      minutesUntilDeparture: null,
      recommendedDeparture: NIGHT,
      expectedArrival: plusMin(NIGHT, 12),
      targetArrival: null,
      fastest: r,
      cheapest: r,
      traffic: { level: 'LOW', peak_label: 'night' },
      weather: clear,
      events: [],
    });
    expect(text).toBe('Leaving at 03:00, you should arrive around 03:12. Fastest is via E311: about 12 min (11-14 min), 10.0 km. Traffic looks light (night).');
  });
});

describe('AI client fallback', () => {
  it('falls back to local heuristics when the AI service is unreachable', async () => {
    const client = createAiClient('http://127.0.0.1:9', 300);
    const input = {
      free_flow_minutes: 20,
      distance_km: 18,
      congestion_factor: 1.5,
      weather: { condition: 'CLEAR' as const, visibility_km: null, rain_mm: 0 },
      disruption_score: 0,
      school_zone_count: 0,
      departure_time: NIGHT.toISOString(),
    };
    expect(await client.predictEta(input)).toEqual(localEta(input));
    expect(client.lastSource()).toBe('fallback');
  });
});
