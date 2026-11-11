import { describe, expect, it } from 'vitest';
import { describeLanes, haversineRoute, parseGoogleRoutes, parseOsrmRoutes } from '../src/services/directions_service';
import { encodePolyline } from '../src/utils/geo';

const line = encodePolyline([
  { lat: 25.2, lng: 55.27 },
  { lat: 25.21, lng: 55.28 },
  { lat: 25.22, lng: 55.29 },
]);

const osrmFixture = {
  code: 'Ok',
  routes: [
    {
      distance: 5200,
      duration: 480,
      geometry: line,
      legs: [
        {
          summary: 'Sheikh Zayed Road, Al Khail Road',
          steps: [
            { distance: 300, duration: 40, name: 'Financial Centre Road', maneuver: { type: 'depart', modifier: 'right', location: [55.27, 25.2] } },
            {
              distance: 4000,
              duration: 360,
              name: 'Sheikh Zayed Road',
              maneuver: { type: 'on ramp', modifier: 'slight left', location: [55.275, 25.205] },
              intersections: [
                {
                  lanes: [
                    { indications: ['left'], valid: true },
                    { indications: ['left', 'straight'], valid: true },
                    { indications: ['straight'], valid: false },
                    { indications: ['right'], valid: false },
                  ],
                },
              ],
            },
            { distance: 900, duration: 80, name: 'Al Khail Road', maneuver: { type: 'turn', modifier: 'right', location: [55.285, 25.215] } },
            { distance: 0, duration: 0, name: '', maneuver: { type: 'arrive', location: [55.29, 25.22] } },
          ],
        },
      ],
    },
  ],
};

describe('OSRM parsing', () => {
  const [route] = parseOsrmRoutes(osrmFixture, 'osrm');

  it('maps distance, duration and geometry', () => {
    expect(route.distanceKm).toBeCloseTo(5.2);
    expect(route.freeFlowMinutes).toBeCloseTo(8);
    expect(route.trafficMinutes).toBeNull();
    expect(route.path).toHaveLength(3);
    expect(route.summary).toBe('via Sheikh Zayed Road and Al Khail Road');
  });

  it('builds readable instructions', () => {
    expect(route.steps.map((s) => s.instruction)).toEqual([
      'Head right on Financial Centre Road',
      'Take the ramp on the slight left onto Sheikh Zayed Road',
      'Turn right onto Al Khail Road',
      'You have arrived at your destination',
    ]);
  });

  it('derives lane guidance from real lane data', () => {
    expect(route.steps[1].laneGuidance).toBe('Use the 2 left lanes to turn left (2 of 4)');
    expect(route.steps[2].laneGuidance).toBeNull();
  });

  it('rejects routing errors', () => {
    expect(() => parseOsrmRoutes({ code: 'NoRoute' }, 'osrm')).toThrow(/NoRoute/);
  });
});

describe('describeLanes', () => {
  it('handles right lanes and single lanes', () => {
    const lanes = [
      { indications: ['straight'], valid: false },
      { indications: ['straight'], valid: false },
      { indications: ['right'], valid: true },
    ];
    expect(describeLanes(lanes, 'right')).toBe('Use the right lane to turn right (1 of 3)');
  });
  it('returns null when every lane works', () => {
    expect(describeLanes([{ indications: ['straight'], valid: true }], 'straight')).toBeNull();
  });
  it('describes middle lanes', () => {
    const lanes = [false, true, true, false].map((valid) => ({ indications: ['straight'], valid }));
    expect(describeLanes(lanes, 'straight')).toBe('Use the middle 2 lanes to continue straight (2 of 4)');
  });
});

describe('Google parsing', () => {
  it('uses duration_in_traffic and strips HTML', () => {
    const [r] = parseGoogleRoutes({
      status: 'OK',
      routes: [
        {
          summary: 'E11',
          overview_polyline: { points: line },
          legs: [
            {
              distance: { value: 10000 },
              duration: { value: 600 },
              duration_in_traffic: { value: 900 },
              steps: [
                {
                  distance: { value: 10000 },
                  duration: { value: 600 },
                  html_instructions: 'Take the ramp onto <b>E11</b><div style="font-size:0.9em">Toll road</div>',
                  maneuver: 'ramp-left',
                  start_location: { lat: 25.2, lng: 55.27 },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(r.summary).toBe('via E11');
    expect(r.freeFlowMinutes).toBe(10);
    expect(r.trafficMinutes).toBe(15);
    expect(r.steps[0].instruction).toBe('Take the ramp onto E11. Toll road');
    expect(r.steps[0].laneGuidance).toBe('Move to the left lanes early');
  });

  it('throws on API errors', () => {
    expect(() => parseGoogleRoutes({ status: 'REQUEST_DENIED', error_message: 'bad key' })).toThrow(/REQUEST_DENIED bad key/);
  });
});

describe('haversine fallback', () => {
  it('approximates road distance as straight line x 1.3 at 60 km/h', () => {
    const r = haversineRoute({ lat: 25.1972, lng: 55.2796 }, { lat: 25.0763, lng: 55.1401 });
    expect(r.distanceKm).toBeCloseTo(19.4 * 1.3, 0);
    expect(r.freeFlowMinutes).toBeCloseTo(r.distanceKm, 5);
    expect(r.steps.at(-1)?.maneuver).toBe('arrive');
  });
});
