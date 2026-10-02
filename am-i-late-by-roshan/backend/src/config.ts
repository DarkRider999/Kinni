import 'dotenv/config';

export type MapProvider = 'osrm' | 'google' | 'mapbox' | 'haversine';

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`Environment variable ${name} must be a number, got "${raw}"`);
  return parsed;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (nodeEnv === 'production') {
    throw new Error('JWT_SECRET must be set (at least 16 characters) in production');
  }
  return 'dev-only-insecure-jwt-secret-change-me';
}

const mapProvider = (process.env.MAP_PROVIDER ?? 'osrm').toLowerCase() as MapProvider;
if (!['osrm', 'google', 'mapbox', 'haversine'].includes(mapProvider)) {
  throw new Error(`MAP_PROVIDER must be one of osrm, google, mapbox, haversine (got "${mapProvider}")`);
}

export const config = {
  nodeEnv,
  port: num('PORT', 3000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/am_i_late',
  // Empty REDIS_URL = in-process event bus (fine for a single backend instance).
  redisUrl: process.env.REDIS_URL ?? '',
  aiServiceUrl: (process.env.AI_SERVICE_URL ?? 'http://localhost:8000').replace(/\/$/, ''),
  aiTimeoutMs: num('AI_TIMEOUT_MS', 2500),

  jwtSecret: jwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '30d',

  mapProvider,
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
  mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN ?? '',
  osrmBaseUrl: (process.env.OSRM_BASE_URL ?? 'https://router.project-osrm.org').replace(/\/$/, ''),
  nominatimBaseUrl: (process.env.NOMINATIM_BASE_URL ?? 'https://nominatim.openstreetmap.org').replace(/\/$/, ''),
  overpassUrl: process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter',
  // Identifies this app to the free OSM services, as their usage policies require.
  osmUserAgent: process.env.OSM_USER_AGENT ?? 'AmILateByRoshan/1.0 (https://github.com/DarkRider999/Kinni)',
  externalHttpTimeoutMs: num('EXTERNAL_HTTP_TIMEOUT_MS', 6000),
  // Set to false (e.g. in tests) to never call third-party APIs.
  externalHttpEnabled: bool('EXTERNAL_HTTP_ENABLED', true),

  openWeatherApiKey: process.env.OPENWEATHER_API_KEY ?? '',
  eventsApiUrl: process.env.EVENTS_API_URL ?? '',

  fcm: {
    projectId: process.env.FCM_PROJECT_ID ?? '',
    clientEmail: process.env.FCM_CLIENT_EMAIL ?? '',
    privateKey: (process.env.FCM_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  },
  apns: {
    keyId: process.env.APNS_KEY_ID ?? '',
    teamId: process.env.APNS_TEAM_ID ?? '',
    bundleId: process.env.APNS_BUNDLE_ID ?? '',
    privateKey: (process.env.APNS_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    production: bool('APNS_PRODUCTION', false),
  },

  llmApiKey: process.env.LLM_API_KEY ?? '',
  llmModel: process.env.LLM_MODEL ?? 'claude-sonnet-5',
  llmBaseUrl: (process.env.LLM_BASE_URL ?? 'https://api.anthropic.com').replace(/\/$/, ''),

  earlyWarningEtaIncreaseMinutes: num('EARLY_WARNING_ETA_INCREASE_MINUTES', 10),
  cronEnabled: bool('CRON_ENABLED', true),
  rateLimitPerMinute: num('RATE_LIMIT_PER_MINUTE', 300),
  corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim()).filter(Boolean),
  logLevel: process.env.LOG_LEVEL ?? (nodeEnv === 'test' ? 'silent' : 'info'),
};

export type AppConfig = typeof config;
