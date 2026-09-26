import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/connection';
import { createCommuteProfile, getCommuteProfile } from '../src/db/models/CommuteProfile';
import { listNotifications } from '../src/db/models/Notification';
import { updateNotificationPreferences } from '../src/db/models/NotificationPreference';
import { checkCommute } from '../src/services/notification_scheduler';
import type { SmartArrivalEngine } from '../src/services/smart_arrival_engine';
import type { PlanResult } from '../src/services/types';
import { databaseAvailable, registerUser, resetDatabase } from './helpers';

const hasDb = await databaseAvailable();

/** An engine stub whose ETA / departure we control. */
function fakeEngine(eta: number, leaveInMinutes: number, verdict: PlanResult['verdict'] = 'ON_TIME'): SmartArrivalEngine {
  return {
    plan: async (input) =>
      ({
        verdict,
        minutesLate: verdict === 'LATE' ? 7 : 0,
        recommendedDeparture: new Date((input.now ?? new Date()).getTime() + leaveInMinutes * 60_000).toISOString(),
        routes: [{ routeType: 'FASTEST', durationMinutes: eta, summary: 'via E11' }],
      }) as unknown as PlanResult,
  };
}

describe.skipIf(!hasDb)('Smart Commute Early-Warning', () => {
  beforeAll(resetDatabase);
  afterAll(() => pool.end());

  // Monday 2026-09-28 07:00 UAE; commute arrives 08:30.
  const now = new Date('2026-09-28T07:00:00+04:00');

  async function setup() {
    const { userId } = await registerUser();
    const commute = await createCommuteProfile(userId, {
      name: 'Work',
      origin: { lat: 25.0763, lng: 55.1401 },
      destination: { lat: 25.2138, lng: 55.2821 },
      destinationLabel: 'Office',
      targetArrivalTime: '08:30',
      daysOfWeek: [1, 2, 3, 4, 5],
    });
    return { userId, commute };
  }

  it('records a baseline, then warns when the ETA jumps past the threshold', async () => {
    const { userId, commute } = await setup();
    const first = await checkCommute(commute, now, fakeEngine(30, 45));
    expect(first).toMatchObject({ etaMinutes: 30, sent: [] });

    const second = await checkCommute((await getCommuteProfile(userId, commute.id))!, new Date(now.getTime() + 5 * 60_000), fakeEngine(44, 25));
    expect(second.sent).toEqual(['EARLY_WARNING']);
    const [n] = await listNotifications(userId);
    expect(n.title).toBe('Traffic worsened on your way to Office');
    expect(n.body).toMatch(/~44 min \(\+14\)/);

    // Cool-down: a further jump 5 minutes later does not spam.
    const third = await checkCommute((await getCommuteProfile(userId, commute.id))!, new Date(now.getTime() + 10 * 60_000), fakeEngine(60, 10));
    expect(third.sent).not.toContain('EARLY_WARNING');
  });

  it('sends LEAVE_NOW once per day', async () => {
    const { userId, commute } = await setup();
    const first = await checkCommute(commute, now, fakeEngine(30, 3));
    expect(first.sent).toEqual(['LEAVE_NOW']);
    const again = await checkCommute((await getCommuteProfile(userId, commute.id))!, new Date(now.getTime() + 5 * 60_000), fakeEngine(30, 0));
    expect(again.sent).toEqual([]);
  });

  it('respects quiet hours, disabled alerts and the commute schedule', async () => {
    const { userId, commute } = await setup();
    await updateNotificationPreferences(userId, { quiet_hours_start: '06:00', quiet_hours_end: '09:00' });
    expect((await checkCommute(commute, now, fakeEngine(30, 0))).sent).toEqual([]);

    const saturday = new Date('2026-10-03T07:00:00+04:00');
    expect((await checkCommute(commute, saturday, fakeEngine(30, 0))).skipped).toBe('not today');
    const tooEarly = new Date('2026-09-28T04:00:00+04:00');
    expect((await checkCommute(commute, tooEarly, fakeEngine(30, 0))).skipped).toBe('outside window');
  });
});
