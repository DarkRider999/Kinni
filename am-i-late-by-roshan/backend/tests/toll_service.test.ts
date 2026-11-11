import { describe, expect, it } from 'vitest';
import { darbFeeAed, estimateTolls, findGatesOnPath, salikFeeAed, TOLL_GATES } from '../src/services/toll_service';

// 2026-09-28 is a Monday; 2026-10-04 a Sunday. Times below are UAE local (+04:00).
const at = (iso: string) => new Date(iso);

describe('Salik pricing', () => {
  it.each([
    ['2026-09-28T07:00:00+04:00', 6], // weekday morning peak
    ['2026-09-28T12:00:00+04:00', 4], // off-peak
    ['2026-09-28T17:30:00+04:00', 6], // evening peak
    ['2026-09-28T21:00:00+04:00', 4], // late evening
    ['2026-09-28T03:00:00+04:00', 0], // free overnight
    ['2026-10-03T08:00:00+04:00', 6], // Saturday is priced like a weekday
    ['2026-10-04T08:00:00+04:00', 4], // Sunday flat
    ['2026-10-04T02:00:00+04:00', 0], // Sunday overnight still free
  ])('%s costs AED %d', (iso, fee) => {
    expect(salikFeeAed(at(iso))).toBe(fee);
  });

  it('treats public holidays like Sunday', () => {
    expect(salikFeeAed(at('2026-09-28T08:00:00+04:00'), { publicHoliday: true })).toBe(4);
  });
});

describe('DARB pricing', () => {
  it.each([
    ['2026-09-28T07:30:00+04:00', 4],
    ['2026-09-28T09:30:00+04:00', 0],
    ['2026-09-28T18:00:00+04:00', 4],
    ['2026-10-04T08:00:00+04:00', 0], // Sunday free
  ])('%s costs AED %d', (iso, fee) => {
    expect(darbFeeAed(at(iso))).toBe(fee);
  });
});

const gate = (id: string) => TOLL_GATES.find((g) => g.id === id)!;
/** A short north-south line passing right through a gate. */
const through = (id: string) => {
  const g = gate(id);
  return [
    { lat: g.lat - 0.01, lng: g.lng },
    { lat: g.lat + 0.01, lng: g.lng },
  ];
};

describe('gate detection', () => {
  it('finds a gate on a route passing through it', () => {
    const found = findGatesOnPath(through('SALIK_AL_BARSHA'));
    expect(found.map((f) => f.gate.id)).toEqual(['SALIK_AL_BARSHA']);
  });

  it('ignores gates more than the match radius away', () => {
    const g = gate('SALIK_AL_BARSHA');
    const offset = [
      { lat: g.lat - 0.01, lng: g.lng + 0.01 },
      { lat: g.lat + 0.01, lng: g.lng + 0.01 },
    ]; // ~1 km east
    expect(findGatesOnPath(offset)).toEqual([]);
  });

  it('orders gates by position along the route', () => {
    const a = gate('SALIK_JEBEL_ALI');
    const b = gate('SALIK_AL_BARSHA');
    const found = findGatesOnPath([{ lat: a.lat - 0.005, lng: a.lng - 0.005 }, a, b, { lat: b.lat + 0.005, lng: b.lng + 0.005 }]);
    expect(found.map((f) => f.gate.id)).toEqual(['SALIK_JEBEL_ALI', 'SALIK_AL_BARSHA']);
  });
});

describe('estimateTolls', () => {
  const peak = at('2026-09-28T08:00:00+04:00');

  it('prices each crossing', () => {
    const est = estimateTolls(through('SALIK_AL_GARHOUD'), peak, 10);
    expect(est.totalAed).toBe(6);
    expect(est.systems).toEqual(['SALIK']);
    expect(est.crossings[0]).toMatchObject({ name: 'Al Garhoud Bridge', feeAed: 6 });
  });

  it('charges Al Mamzar North + South once', () => {
    const s = gate('SALIK_AL_MAMZAR_S');
    const n = gate('SALIK_AL_MAMZAR_N');
    const est = estimateTolls([{ lat: s.lat - 0.005, lng: s.lng - 0.005 }, s, n, { lat: n.lat + 0.005, lng: n.lng + 0.005 }], peak, 10);
    expect(est.crossings).toHaveLength(2);
    expect(est.totalAed).toBe(6);
    expect(est.notes.join()).toMatch(/no extra charge/);
  });

  it('prices each gate at the time it is reached', () => {
    // Leave 09:50 on a 40-minute drive: a gate at the far end is reached after 10:00 (off-peak).
    const g = gate('SALIK_AL_GARHOUD');
    const path = [{ lat: g.lat - 0.2, lng: g.lng }, { lat: g.lat, lng: g.lng }];
    const est = estimateTolls(path, at('2026-09-28T09:50:00+04:00'), 40);
    expect(est.crossings[0].feeAed).toBe(4);
  });

  it('applies the DARB daily cap', () => {
    const est = estimateTolls(through('DARB_SHEIKH_ZAYED_BRIDGE'), peak, 5, { alreadyPaidDarbTodayAed: 14 });
    expect(est.totalAed).toBe(2);
    expect(est.notes.join()).toMatch(/daily cap/);
  });

  it('is free with no gates', () => {
    expect(estimateTolls([{ lat: 25, lng: 56 }, { lat: 25.01, lng: 56.01 }], peak, 5).totalAed).toBe(0);
  });
});
