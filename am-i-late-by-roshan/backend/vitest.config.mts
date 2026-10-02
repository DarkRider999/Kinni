import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Integration tests share one database; run files sequentially.
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/am_i_late_test',
      REDIS_URL: '',
      AI_SERVICE_URL: 'local',
      MAP_PROVIDER: 'haversine',
      EXTERNAL_HTTP_ENABLED: 'false',
      CRON_ENABLED: 'false',
      JWT_SECRET: 'test-secret-at-least-16-chars',
      LLM_API_KEY: '',
      FCM_PROJECT_ID: '',
    },
  },
});
