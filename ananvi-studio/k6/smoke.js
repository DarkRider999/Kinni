// k6/smoke.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3001';

export default function() {
  // Health check
  let res = http.get(`${BASE}/health`);
  check(res, { 'health 200': (r) => r.status === 200 });

  // Register
  res = http.post(`${BASE}/auth/register`, JSON.stringify({
    email: `smoke-${Date.now()}-${__VU}@test.com`,
    password: 'Str0ng!Pass99',
    name: 'Smoke',
  }), { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'register 201': (r) => r.status === 201 });

  const token = res.json('accessToken');

  // Authenticated request
  res = http.get(`${BASE}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(res, { 'me 200': (r) => r.status === 200 });

  sleep(1);
}
