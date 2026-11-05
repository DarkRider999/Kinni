// k6/stress.js
export const options = {
  stages: [
    { duration: '2m',  target: 100 },
    { duration: '5m',  target: 100 },
    { duration: '2m',  target: 200 },
    { duration: '5m',  target: 200 },
    { duration: '2m',  target: 300 },
    { duration: '5m',  target: 300 },
    { duration: '5m',  target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.15'],
  },
};

// k6/spike.js
export const options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '1m',  target: 10 },
    { duration: '10s', target: 500 },  // SPIKE
    { duration: '3m',  target: 500 },
    { duration: '10s', target: 10 },   // Recovery
    { duration: '3m',  target: 10 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(99)<2000'],
    http_req_failed: ['rate<0.20'],
  },
};
