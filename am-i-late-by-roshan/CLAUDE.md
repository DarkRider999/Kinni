# Am I Late? by Roshan: project brief for Claude Code

## Vision

"Am I Late? by Roshan" is an AI-powered UAE mobility intelligence assistant for iOS/Android that:

- Predicts traffic and recommends departure time to hit a target arrival
- Compares routes by time, cost (Salik/DARB tolls), and stress
- Monitors road speed vs. posted limits and driver fatigue in real time
- Sends proactive commute alerts when traffic changes significantly
- Adapts journeys in real time based on live conditions

## Tech stack (do not change without being asked)

- **Frontend:** Flutter (Dart), Material 3, `flutter_map` with OpenStreetMap tiles (switched from `google_maps_flutter` at the owner's request so maps need no API key or billing)
- **Backend:** Node.js + Express 5, TypeScript
- **Database:** PostgreSQL + PostGIS (geography columns for all lat/lng data)
- **Real-time:** Redis pub/sub (`ioredis`) for traffic updates + notification fan-out (in-process bus when `REDIS_URL` is empty)
- **AI layer:** Python 3 + FastAPI, heuristic models (not yet trained ML)
- **Maps/routing:** `MAP_PROVIDER` = `osrm` (free default) | `google` | `mapbox` | `haversine` (offline)
- **Notifications:** in-app inbox + SSE stream always; Firebase Cloud Messaging when configured; APNs documented as extension point
- **Scheduling:** `node-cron`, 5-minute Smart Commute Early-Warning job

## Current state

Working end to end and tested; free to run (every paid API is optional).

- Backend: JWT auth (user id always derived server-side), real Directions (OSRM/Google/Mapbox with polylines, turn-by-turn steps and lane data; haversine fallback), Salik/DARB pricing, PostGIS school zones and events, Open-Meteo/OpenWeather weather, OSM place search/speed limits/car parks, SSE notifications over Redis, FCM push, rule-based or Claude assistant, privacy export/delete, rate limiting, structured logging (pino), migrations applied on boot. `npx tsc --noEmit` clean; 83 vitest tests (unit + PostGIS integration).
- AI service: `/predict/traffic`, `/predict/eta`, `/score/disruption`, `/score/driver-state`; 40 pytest tests. The backend mirrors these heuristics locally (`ai_client.ts`) and falls back to them if the service is down.
- Flutter: login, home (map, place search, arrive-by, commutes, recent trips, assistant), trip result (verdict, 3 routes, ETA confidence, parking), navigation (turn-by-turn, lane arrows, speed vs limit, off-route re-route, periodic re-plan, crowd speed reports, fatigue overlay), settings (profile, commutes, privacy, server URL), notification settings + inbox. `flutter analyze` clean; 19 tests. Android/iOS platform projects configured (permissions, Maps key injection, desugaring).
- `docker-compose.yml` brings up PostGIS, Redis, AI service and backend. CI: `.github/workflows/am-i-late.yml` (backend on PostGIS, pytest, docker build, flutter analyze/test + release APK artifact).

## Project structure

```
am-i-late-by-roshan/
├── README.md, CLAUDE.md, docker-compose.yml
├── flutter_app/lib/
│   ├── main.dart, app_scope.dart
│   ├── screens/   login, home, trip_result, navigation, settings (+ commute editor), notification_settings
│   ├── widgets/   app_map (OSM map, pins), route_card, eta_confidence_widget, speed_indicator_widget, sleep_alert_overlay,
│   │              place_search_field, assistant_sheet
│   ├── services/  api_client, location_service, sensor_service, notification_service
│   ├── models/    trip, route_option, driver_profile (+ CommuteProfile), notification_preference (+ AppNotification), place
│   └── utils/     polyline, geo, format
├── backend/src/
│   ├── index.ts (server + cron + redis subscriber), app.ts (express app), config.ts, logger.ts
│   ├── routes/    auth, trip, traffic, tolls, parking, places, notifications, driver_profile, assistant, privacy
│   ├── services/  smart_arrival_engine, directions_service, ai_client, traffic_service, toll_service,
│   │              parking_service, places_service, weather_service, event_service, school_zone_service,
│   │              notification_scheduler, push_notification_service, assistant_service, engine_factory, types
│   ├── db/        connection.ts, migrate.ts, models/ (User, Trip, RouteOption, DriverProfile,
│   │              CommuteProfile, NotificationPreference, Notification)
│   ├── middleware/ auth (JWT), error
│   └── redis/pubsub.ts
├── backend/tests/ geo, toll_service, directions, smart_arrival_engine, api (integration), scheduler
├── ai-service/app/ main.py, schemas.py, models/ (eta, traffic_forecast, disruption_score, geo),
│                   services/ (prediction_service, driver_state_service); tests/
└── database/migrations/ 001..012
```

## Environment variables

See `backend/.env.example` (fully commented) and `ai-service/.env.example`. Flutter: `--dart-define=API_BASE_URL=...` or the in-app server setting; map tiles default to OpenStreetMap, overridable with `--dart-define=MAP_TILE_URL=...`; Firebase config files are optional and git-ignored.

## Remaining next steps (priority order)

1. **Production hosting**: deploy the compose stack (or managed Postgres/PostGIS + Redis) behind HTTPS, then remove `usesCleartextTraffic` from the Android manifest and set a real release signing config.
2. **Self-host OSRM** with a GCC OpenStreetMap extract (the public demo server is for light use only), or switch `MAP_PROVIDER` to google/mapbox for live-traffic durations.
3. **Train models** once `traffic_snapshots` has enough data: the dataclass contracts in `ai-service/app/models/` are the drop-in points; keep `ai_client.ts` fallbacks in sync.
4. **Official data**: replace sample school-zone polygons (migration 011) with KHDA/ADEK data; connect `EVENTS_API_URL` to a real events feed; add UAE public-holiday calendar to toll pricing (`publicHoliday` option exists).
5. **Background alerts without Firebase** are limited to while the app runs; for closed-app alerts, finish Firebase setup (README) or implement direct APNs in `push_notification_service.ts`.
6. Background location / CarPlay / Android Auto, Arabic localisation, and a refresh-token flow (JWTs currently last 30 days).

## Constraints when extending

- Keep the stack; keep route/model/table names stable (the three services call each other by these contracts).
- Extend existing `services/` files rather than creating parallel logic (new toll systems go in `toll_service.ts`).
- Never trust a client-supplied user id; use `userIdOf(req)`.
- Use environment variables for secrets and document new ones in `.env.example`.
- When changing AI heuristics, update both `ai-service/app/models/*` and the mirrored fallbacks in `backend/src/services/ai_client.ts`.
