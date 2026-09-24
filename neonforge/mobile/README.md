# NeonForge AI: mobile (Flutter)

Android and iOS client for the NeonForge backend. It has the same flows as the web app: Home, Single Edit (editor with
before/after slider, tool panels, edit stack and live previews), Export (save to gallery or share), Batch Edit
(multi-file or folder upload, recipe builder, live batch manager with ZIP share) and Settings.

```bash
flutter pub get
flutter run --dart-define=NF_API_URL=http://10.0.2.2:8000   # Android emulator → API on the host
flutter analyze && flutter test
```

- The API base URL comes from `--dart-define=NF_API_URL=…`. Debug builds allow cleartext HTTP (`android/app/src/debug`).
- Live job progress uses the API WebSocket, with a polling fallback (`Session.watchJob`).
- `lib/recipe.dart` mirrors the backend recipe schema. Keep it in sync with `web/src/lib/recipe.ts`.
