import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/connection';
import { createMemoryBus, setBusForTests } from '../src/redis/pubsub';
import { app, auth, databaseAvailable, registerUser, resetDatabase } from './helpers';

const hasDb = await databaseAvailable();
const bus = createMemoryBus();
setBusForTests(bus);

const DIFC = { lat: 25.2138, lng: 55.2821, label: 'DIFC' };
const MARINA = { lat: 25.0763, lng: 55.1401, label: 'Dubai Marina Mall' };

describe.skipIf(!hasDb)('API (integration)', () => {
  beforeAll(resetDatabase);
  afterAll(() => pool.end());

  describe('health', () => {
    it('reports status', async () => {
      const res = await request(app).get('/health').expect(200);
      expect(res.body).toMatchObject({ status: 'ok', database: true, mapProvider: 'haversine', push: 'in-app', assistant: 'rules' });
    });
    it('404s unknown routes as JSON', async () => {
      const res = await request(app).get('/nope').expect(404);
      expect(res.body.error.code).toBe('not_found');
    });
  });

  describe('auth', () => {
    it('registers, logs in and returns the current user', async () => {
      await request(app).post('/auth/register').send({ email: 'Roshan@Example.com', password: 'longpassword1' }).expect(201);
      await request(app).post('/auth/register').send({ email: 'roshan@example.com', password: 'longpassword1' }).expect(409);
      const login = await request(app).post('/auth/login').send({ email: 'roshan@example.com', password: 'longpassword1' }).expect(200);
      expect(login.body.user).not.toHaveProperty('password_hash');
      const me = await request(app).get('/auth/me').set(auth(login.body.token)).expect(200);
      expect(me.body.user.email).toBe('roshan@example.com');
    });

    it('rejects bad credentials and weak input', async () => {
      await request(app).post('/auth/login').send({ email: 'roshan@example.com', password: 'wrong-password' }).expect(401);
      await request(app).post('/auth/login').send({ email: 'nobody@example.com', password: 'whatever12' }).expect(401);
      const res = await request(app).post('/auth/register').send({ email: 'not-an-email', password: 'short' }).expect(400);
      expect(res.body.error.code).toBe('validation_error');
    });

    it('requires a valid token on protected routes', async () => {
      await request(app).get('/trips').expect(401);
      await request(app).get('/trips').set(auth('garbage')).expect(401);
    });
  });

  describe('trips', () => {
    let token: string;
    beforeEach(async () => ({ token } = await registerUser()));

    it('plans, saves, lists and fetches a trip with three route options', async () => {
      const targetArrival = new Date(Date.now() + 90 * 60_000).toISOString();
      const plan = await request(app).post('/trips/plan').set(auth(token)).send({ origin: MARINA, destination: DIFC, targetArrival }).expect(200);
      expect(plan.body.verdict).toMatch(/ON_TIME|LEAVE_NOW|LATE/);
      expect(plan.body.routes.map((r: { routeType: string }) => r.routeType)).toEqual(['FASTEST', 'CHEAPEST', 'LOW_STRESS']);
      expect(plan.body.explanation).toMatch(/Fastest is/);
      expect(plan.body.context.aiSource).toBe('fallback');
      expect(plan.body.tripId).toBeTruthy();

      const list = await request(app).get('/trips').set(auth(token)).expect(200);
      expect(list.body.trips).toHaveLength(1);
      expect(list.body.trips[0].destination).toEqual({ lat: DIFC.lat, lng: DIFC.lng });

      const trip = await request(app).get(`/trips/${plan.body.tripId}`).set(auth(token)).expect(200);
      expect(trip.body.trip.routes).toHaveLength(3);
      expect(trip.body.trip.routes[0].polyline).toBe(plan.body.routes[0].polyline);
    });

    it('does not save when save=false and validates input', async () => {
      const res = await request(app).post('/trips/plan').set(auth(token)).send({ origin: MARINA, destination: DIFC, save: false }).expect(200);
      expect(res.body.tripId).toBeUndefined();
      expect(res.body.verdict).toBe('NO_TARGET');
      await request(app).post('/trips/plan').set(auth(token)).send({ origin: { lat: 999, lng: 0 }, destination: DIFC }).expect(400);
    });

    it('runs the trip lifecycle and sends an arrival notification', async () => {
      const targetArrival = new Date(Date.now() + 60 * 60_000).toISOString();
      const { body } = await request(app).post('/trips/plan').set(auth(token)).send({ origin: MARINA, destination: DIFC, targetArrival }).expect(200);
      const started = await request(app).post(`/trips/${body.tripId}/start`).set(auth(token)).send({ routeType: 'CHEAPEST' }).expect(200);
      expect(started.body.trip).toMatchObject({ status: 'IN_PROGRESS', selected_route_type: 'CHEAPEST' });
      const done = await request(app).post(`/trips/${body.tripId}/complete`).set(auth(token)).expect(200);
      expect(done.body.trip.status).toBe('COMPLETED');
      const inbox = await request(app).get('/notifications').set(auth(token)).expect(200);
      expect(inbox.body.notifications[0]).toMatchObject({ kind: 'TRIP', title: 'You made it on time' });
    });

    it("hides other users' trips", async () => {
      const { body } = await request(app).post('/trips/plan').set(auth(token)).send({ origin: MARINA, destination: DIFC }).expect(200);
      const other = await registerUser();
      await request(app).get(`/trips/${body.tripId}`).set(auth(other.token)).expect(404);
      await request(app).post(`/trips/${body.tripId}/cancel`).set(auth(other.token)).expect(404);
    });
  });

  describe('driver profile & commutes', () => {
    let token: string;
    beforeEach(async () => ({ token } = await registerUser()));

    it('creates a default profile and updates it', async () => {
      const res = await request(app).get('/driver-profile').set(auth(token)).expect(200);
      expect(res.body.profile).toMatchObject({ has_salik_tag: true, buffer_minutes: 5, preferred_route_type: 'FASTEST' });
      const upd = await request(app).put('/driver-profile').set(auth(token)).send({ buffer_minutes: 12, preferred_route_type: 'CHEAPEST' }).expect(200);
      expect(upd.body.profile).toMatchObject({ buffer_minutes: 12, preferred_route_type: 'CHEAPEST' });
      await request(app).put('/driver-profile').set(auth(token)).send({ user_id: 'x' }).expect(400);
    });

    it('CRUDs commutes and runs an on-demand check', async () => {
      const soon = new Date(Date.now() + 60 * 60_000 + 4 * 3600_000); // UAE wall clock in 1h
      const hhmm = `${String(soon.getUTCHours()).padStart(2, '0')}:${String(soon.getUTCMinutes()).padStart(2, '0')}`;
      const created = await request(app)
        .post('/driver-profile/commutes')
        .set(auth(token))
        .send({ name: 'Work', origin: MARINA, originLabel: 'Home', destination: DIFC, destinationLabel: 'Office', targetArrivalTime: hhmm, daysOfWeek: [1, 2, 3, 4, 5, 6, 7] })
        .expect(201);
      const id = created.body.commute.id;
      expect(created.body.commute).toMatchObject({ name: 'Work', target_arrival_time: hhmm, destination: { lat: DIFC.lat, lng: DIFC.lng } });

      const check = await request(app).post(`/driver-profile/commutes/${id}/check`).set(auth(token)).expect(200);
      expect(check.body.result.etaMinutes).toBeGreaterThan(0);

      const list = await request(app).get('/driver-profile/commutes').set(auth(token)).expect(200);
      expect(list.body.commutes[0].last_eta_minutes).toBeCloseTo(check.body.result.etaMinutes, 1);

      await request(app).put(`/driver-profile/commutes/${id}`).set(auth(token)).send({ origin: MARINA, destination: DIFC, targetArrivalTime: '09:15', active: false }).expect(200);
      await request(app).delete(`/driver-profile/commutes/${id}`).set(auth(token)).expect(204);
      await request(app).delete(`/driver-profile/commutes/${id}`).set(auth(token)).expect(404);
    });

    it('scores fatigue and alerts when the drive limit is exceeded', async () => {
      const res = await request(app).post('/driver-profile/fatigue-check').set(auth(token)).send({ continuousDriveMinutes: 150, steeringVariance: 0.1 }).expect(200);
      expect(res.body).toMatchObject({ over_drive_limit: true, should_alert: true });
      const inbox = await request(app).get('/notifications?unread=true').set(auth(token)).expect(200);
      expect(inbox.body.notifications[0].kind).toBe('FATIGUE');
    });
  });

  describe('notifications', () => {
    let token: string;
    let userId: string;
    beforeEach(async () => ({ token, userId } = await registerUser()));

    it('reads and updates preferences', async () => {
      const res = await request(app).get('/notifications/preferences').set(auth(token)).expect(200);
      expect(res.body).toMatchObject({ pushConfigured: false, preferences: { early_warning_enabled: true } });
      const upd = await request(app)
        .put('/notifications/preferences')
        .set(auth(token))
        .send({ eta_increase_threshold_minutes: 7, quiet_hours_start: '23:00', quiet_hours_end: '06:00' })
        .expect(200);
      expect(upd.body.preferences).toMatchObject({ eta_increase_threshold_minutes: 7, quiet_hours_start: '23:00:00' });
      await request(app).put('/notifications/preferences').set(auth(token)).send({ quiet_hours_start: '25:00' }).expect(400);
    });

    it('registers devices and delivers speeding alerts to the inbox and the live bus', async () => {
      await request(app).post('/notifications/devices').set(auth(token)).send({ token: 'fcm-token-1234567890', platform: 'android' }).expect(201);
      const received: unknown[] = [];
      const unsubscribe = bus.subscribe(`notifications:user:${userId}`, (m) => received.push(m));
      const res = await request(app).post('/traffic/report').set(auth(token)).send({ lat: 25.2, lng: 55.27, speedKmh: 131, speedLimitKmh: 100 }).expect(201);
      unsubscribe();
      expect(res.body).toEqual({ recorded: true, speeding: true });
      expect(received).toHaveLength(1);
      const inbox = await request(app).get('/notifications').set(auth(token)).expect(200);
      const n = inbox.body.notifications[0];
      expect(n).toMatchObject({ kind: 'SPEED', title: 'Slow down' });
      await request(app).post(`/notifications/${n.id}/read`).set(auth(token)).expect(200);
      await request(app).post(`/notifications/${n.id}/read`).set(auth(token)).expect(404);
    });
  });

  describe('traffic, tolls, parking, places', () => {
    let token: string;
    beforeEach(async () => ({ token } = await registerUser()));

    it('forecasts traffic', async () => {
      const res = await request(app).get('/traffic/forecast').query({ lat: 25.2, lng: 55.27, at: '2026-09-28T08:00:00+04:00' }).expect(200);
      expect(res.body.level).toMatch(/HEAVY|SEVERE/);
      expect(res.body.forecast).toHaveLength(9);
    });

    it('aggregates crowd speed from anonymous reports', async () => {
      for (const speed of [30, 36, 42]) {
        await request(app).post('/traffic/report').set(auth(token)).send({ lat: 25.25, lng: 55.3, speedKmh: speed, speedLimitKmh: 100 }).expect(201);
      }
      const res = await request(app).get('/traffic/crowd').query({ lat: 25.25, lng: 55.3 }).expect(200);
      expect(res.body.crowd).toMatchObject({ samples: 3, avgSpeedKmh: 36 });
      expect(res.body.crowd.ratio).toBeCloseTo(0.36);
    });

    it('falls back to road-name speed limits offline', async () => {
      const res = await request(app).get('/traffic/speed-limit').query({ lat: 25.2, lng: 55.27, road: 'Sheikh Zayed Road' }).expect(200);
      expect(res.body).toEqual({ speedLimitKmh: 100, roadName: 'Sheikh Zayed Road', source: 'road-name' });
    });

    it('lists toll gates and estimates tolls for a polyline', async () => {
      const gates = await request(app).get('/tolls/gates').expect(200);
      expect(gates.body.gates.length).toBe(14);
      const res = await request(app)
        .post('/tolls/estimate')
        .send({ polyline: '_ntyCsqxpI_seK??', departure: '2026-09-28T08:00:00+04:00' })
        .expect(200);
      expect(res.body).toHaveProperty('totalAed');
      await request(app).post('/tolls/estimate').send({}).expect(400);
    });

    it('estimates parking tariffs', async () => {
      const res = await request(app).get('/parking/nearby').query({ lat: DIFC.lat, lng: DIFC.lng, at: '2026-09-28T09:00:00+04:00' }).expect(200);
      expect(res.body.tariff).toMatchObject({ emirate: 'Dubai', standardAedPerHour: 4, premiumAedPerHour: 6, free: false });
      expect(res.body.carParks).toEqual([]); // external lookups are disabled in tests
    });

    it('searches built-in landmarks when OSM is unavailable', async () => {
      const res = await request(app).get('/places/search').query({ q: 'dubai mall' }).expect(200);
      expect(res.body.results[0]).toMatchObject({ label: 'Dubai Mall', source: 'builtin' });
      const rev = await request(app).get('/places/reverse').query({ lat: 25.1973, lng: 55.2797 }).expect(200);
      expect(rev.body.place.label).toBe('Near Dubai Mall');
    });
  });

  describe('events & school zones', () => {
    it('includes a nearby event in the trip explanation', async () => {
      const { token } = await registerUser();
      await pool.query(
        `INSERT INTO events (venue_id, name, starts_at, ends_at, expected_attendance)
         SELECT id, 'Test Expo', now() + interval '40 minutes', now() + interval '5 hours', 30000 FROM venues WHERE name = 'Dubai World Trade Centre'`,
      );
      // Straight line from Karama to Satwa passes right by DWTC.
      const res = await request(app)
        .post('/trips/plan')
        .set(auth(token))
        .send({ origin: { lat: 25.235, lng: 55.3 }, destination: { lat: 25.215, lng: 55.275 } })
        .expect(200);
      expect(res.body.context.events[0]).toMatchObject({ name: 'Test Expo', venue: 'Dubai World Trade Centre' });
      expect(res.body.explanation).toMatch(/Test Expo at Dubai World Trade Centre/);
    });

    it('detects sample school zones crossed by a route during school hours', async () => {
      const { schoolZonesOnRoute } = await import('../src/services/school_zone_service');
      const path = [
        { lat: 25.21, lng: 55.41 },
        { lat: 25.23, lng: 55.43 },
      ]; // through the Mirdif sample cluster
      const schoolTime = new Date('2026-09-28T07:30:00+04:00'); // Monday
      const weekend = new Date('2026-10-03T07:30:00+04:00'); // Saturday
      expect((await schoolZonesOnRoute(path, schoolTime)).map((z) => z.name)).toEqual(['Mirdif school cluster (sample)']);
      expect(await schoolZonesOnRoute(path, weekend)).toEqual([]);
    });
  });

  describe('assistant', () => {
    it('answers with rules when no LLM key is configured', async () => {
      const { token } = await registerUser();
      const noCommute = await request(app).post('/assistant/chat').set(auth(token)).send({ message: 'Am I late for work?' }).expect(200);
      expect(noCommute.body).toMatchObject({ intent: 'commute', source: 'rules' });
      expect(noCommute.body.reply).toMatch(/Add a commute/);
      await request(app)
        .post('/driver-profile/commutes')
        .set(auth(token))
        .send({ name: 'Work', origin: MARINA, destination: DIFC, destinationLabel: 'Office', targetArrivalTime: '08:30', daysOfWeek: [1, 2, 3, 4, 5, 6, 7] })
        .expect(201);
      const withCommute = await request(app).post('/assistant/chat').set(auth(token)).send({ message: 'When should I leave for work?' }).expect(200);
      expect(withCommute.body.reply).toMatch(/Fastest is/);
      expect(withCommute.body.tripPlan.routes).toHaveLength(3);
      const tolls = await request(app).post('/assistant/chat').set(auth(token)).send({ message: 'how much salik?' }).expect(200);
      expect(tolls.body.reply).toMatch(/Salik gate costs AED/);
    });
  });

  describe('privacy', () => {
    it('exports all data and deletes the account', async () => {
      const { token } = await registerUser();
      await request(app).post('/trips/plan').set(auth(token)).send({ origin: MARINA, destination: DIFC }).expect(200);
      const exp = await request(app).get('/privacy/export').set(auth(token)).expect(200);
      expect(exp.body.trips).toHaveLength(1);
      expect(exp.body.trips[0].routes).toHaveLength(3);
      await request(app).delete('/privacy/account').set(auth(token)).send({}).expect(400);
      await request(app).delete('/privacy/account').set(auth(token)).send({ confirm: 'DELETE' }).expect(204);
      await request(app).get('/auth/me').set(auth(token)).expect(404);
    });
  });
});
