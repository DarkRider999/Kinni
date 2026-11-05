// k6/load.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const jobCreateTime = new Trend('job_create_duration');

export const options = {
  stages: [
    { duration: '2m',  target: 50 },   // Ramp up
    { duration: '5m',  target: 50 },   // Steady
    { duration: '2m',  target: 100 },  // Peak
    { duration: '5m',  target: 100 },  // Sustained peak
    { duration: '2m',  target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.1'],
    job_create_duration: ['p(95)<1000'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3001';

export function setup() {
  // Pre-register test users with credits
  const users = [];
  for (let i = 0; i < 100; i++) {
    const res = http.post(`${BASE}/auth/register`,
      JSON.stringify({
        email: `load-${i}@test.com`,
        password: 'Load1234!',
        name: `Load ${i}`,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (res.status === 201) {
      users.push(res.json('accessToken'));
    }
  }
  return { tokens: users };
}

export default function(data) {
  const token = data.tokens[__VU % data.tokens.length];
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // GET /jobs — list jobs
  let res = http.get(`${BASE}/jobs`, { headers });
  check(res, { 'jobs list 200': (r) => r.status === 200 })
    || errorRate.add(1);

  // POST /jobs — create job
  res = http.post(`${BASE}/jobs`, JSON.stringify({
    sourceUrl: `https://youtube.com/watch?v=load${__ITER}`,
    clipCount: 10,
    captionStyle: 'wavy',
  }), { headers });
  jobCreateTime.add(res.timings.duration);

  // GET /billing/credits — check balance
  res = http.get(`${BASE}/billing/credits`, { headers });
  check(res, { 'credits 200': (r) => r.status === 200 });

  sleep(Math.random() * 2 + 1);
}
