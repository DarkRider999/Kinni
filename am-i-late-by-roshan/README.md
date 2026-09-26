# Am I Late? by Roshan

An AI-powered UAE mobility assistant for iOS and Android. Tell it where you're going and when you need to be there; it tells you **whether you're late, when to leave, and which route to take**, accounting for UAE rush hours, Salik/DARB tolls, weather, events and school zones. While you drive it guides you turn by turn (with lane guidance), watches your speed against the limit, warns you when you seem tired, and re-routes when traffic changes.

**Runs free out of the box.** Every paid service is optional:

| Need | Free default | Optional upgrade |
|---|---|---|
| Road routing | OSRM (OpenStreetMap), no key | Google Directions / Mapbox (traffic-aware) |
| Place search, speed limits, car parks | OpenStreetMap Nominatim + Overpass | - |
| Weather | Open-Meteo, no key | OpenWeather |
| Push alerts | In-app live stream + inbox | Firebase Cloud Messaging (free tier) |
| Assistant | Built-in rules | Claude via `LLM_API_KEY` |
| Map display in the app | Google Maps SDK (mobile map loads cost $0; needs a free key) | - |

## Features

- **Am I late?** Verdict (on time / leave now / late by N min), recommended departure, expected arrival and a plain-language explanation.
- **Three routes**: fastest, cheapest (Salik/DARB with 2025 variable Salik pricing, paired-gate and DARB-cap rules) and low-stress.
- **ETA with confidence**: best/worst-case range from the AI service.
- **Smart Commute Early-Warning**: saved commutes are re-checked every 5 minutes; you get "traffic worsened" and "time to leave" alerts.
- **Navigation**: turn-by-turn, lane arrows from real lane data, speed vs limit, off-route re-routing, "faster route available" switching, crowd-sourced speed reporting.
- **Fatigue monitoring**: drive time, circadian risk, steering variance and harsh events (computed on the phone) feed a driver-state model; a full-screen alert tells you to rest.
- **Ask Roshan** assistant, parking tariffs and nearby car parks, notification settings with quiet hours, data export and account deletion.

## Architecture

```
flutter_app/   Flutter (Material 3, google_maps_flutter)  -> talks to backend with a JWT
backend/       Node.js + Express + TypeScript              -> Postgres/PostGIS, Redis, AI service, OSM/Google/Mapbox
ai-service/    Python FastAPI                              -> heuristic traffic / ETA / disruption / fatigue models
database/      SQL migrations 001..012 (applied automatically by the backend)
```

## Quick start (whole stack, one command)

Requires Docker.

```bash
cd am-i-late-by-roshan
docker compose up --build
curl http://localhost:3000/health
```

Then run the app (next section) and point it at `http://<your-computer-ip>:3000`.

For anything beyond local testing set a real `JWT_SECRET` (and a DB password) first, e.g. `JWT_SECRET=$(openssl rand -hex 32) docker compose up -d`. Put optional API keys in `backend/.env` (copy `backend/.env.example`).

## Run the mobile app

1. Install Flutter (stable) and Android Studio or Xcode.
2. Get a free Google Maps SDK key (Google Cloud console, enable "Maps SDK for Android" / "Maps SDK for iOS").
   - Android: add `MAPS_API_KEY=your-key` to `flutter_app/android/local.properties`.
   - iOS: create `flutter_app/ios/Flutter/Secrets.xcconfig` containing `MAPS_API_KEY=your-key`.
   Without a key the app still works; the map area is just blank.
3. Run:
   ```bash
   cd flutter_app
   flutter pub get
   flutter run                                   # emulator: backend at http://10.0.2.2:3000
   flutter run --dart-define=API_BASE_URL=http://192.168.1.10:3000   # real phone on your Wi-Fi
   ```
   You can also change the server address on the sign-in screen or in Settings.

**Just want the APK?** Every push runs the `Am I Late` GitHub Actions workflow, which builds `am-i-late-apk` (download it from the workflow run's Artifacts). Set the repository variable `AM_I_LATE_API_BASE_URL` to your server URL and the secret `MAPS_API_KEY` to bake them in.

### Optional: push notifications when the app is closed

Create a free Firebase project, add Android (`com.roshan.am_i_late`) and iOS apps, drop `google-services.json` into `flutter_app/android/app/` and `GoogleService-Info.plist` into `flutter_app/ios/Runner/`, then set `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` (from a service-account key) in `backend/.env`. For Android, also add the `com.google.gms.google-services` Gradle plugin. Without Firebase, alerts arrive through the in-app live stream while the app is running.

## Run services without Docker

```bash
# Database (needs PostGIS). Migrations run automatically when the backend starts.
createdb am_i_late

# AI service
cd ai-service && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000

# Backend (Redis optional: leave REDIS_URL empty for an in-process bus)
cd backend && cp .env.example .env && npm install && npm run dev
```

## Tests

```bash
cd backend && npm test               # 83 tests; integration tests use TEST_DATABASE_URL (PostGIS) and are skipped if it is unreachable
cd ai-service && pip install -r requirements-dev.txt && python -m pytest
cd flutter_app && flutter analyze && flutter test
```

## API overview

All routes except `/health`, `/auth/register`, `/auth/login` and the public lookups take `Authorization: Bearer <token>`; the server derives the user from it.

| Method & path | Purpose |
|---|---|
| `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | Accounts (JWT) |
| `POST /trips/plan` | "Am I late?": verdict, departure time, 3 routes, explanation |
| `GET /trips`, `GET /trips/:id`, `POST /trips/:id/start\|complete\|cancel` | Trip history and lifecycle |
| `GET /traffic/forecast`, `GET /traffic/speed-limit`, `POST /traffic/report`, `GET /traffic/crowd` | Traffic |
| `GET /tolls/gates`, `POST /tolls/estimate` | Salik / DARB |
| `GET /parking/nearby` | Tariff estimate + nearby car parks |
| `GET /places/search`, `GET /places/reverse` | Place search (UAE) |
| `GET/PUT /driver-profile`, `POST /driver-profile/fatigue-check`, `/driver-profile/commutes[...]` | Profile, fatigue, commutes |
| `GET/PUT /notifications/preferences`, `GET /notifications`, `GET /notifications/stream` (SSE), `POST /notifications/devices` | Alerts |
| `POST /assistant/chat` | Ask Roshan |
| `GET /privacy/export`, `DELETE /privacy/account` | Your data |

AI service: `POST /predict/traffic`, `POST /predict/eta`, `POST /score/disruption`, `POST /score/driver-state` (interactive docs at `/docs`).

## Data notes

Toll gate coordinates are approximate and tariffs reflect the rules published at the time of writing (see the header of `backend/src/services/toll_service.ts`). School zones seeded by migration 011 are **sample** clusters; load official polygons for production. Traffic predictions come from transparent heuristics until enough `traffic_snapshots` accumulate to train a model.
