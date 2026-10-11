# 02 · System Architecture

## 1. Context

```
                ┌──────────────────────── Anjali's phone ────────────────────────┐
                │                                                                 │
  Dialer ◄──────┤  Anjali CRM AI (Flutter)                                        │
  WhatsApp ◄────┤   ├─ Presentation (screens, widgets)          Riverpod          │
  Maps app ◄────┤   ├─ Application (providers / controllers)  ◄─ state graph      │
  Share sheet ◄─┤   ├─ Domain (entities, pure business rules)                     │
  Camera/Mic ──►│   ├─ Data (Hive repos, sync, backup, export)                    │
  Contacts ────►│   └─ Platform services (notifications, auth, OCR, STT, GPS)     │
                │        │                       │                                │
                │   Hive (AES-256)          WorkManager (sync + backup, 15 min/24 h)│
                └────────┼───────────────────────┼────────────────────────────────┘
                         │ when online           │
                         ▼                       ▼
              Firebase Auth (anonymous uid) → Firestore users/{uid}/…  ·  Storage users/{uid}/files/…
              Crashlytics · Analytics (no PII)
```

## 2. Layering (Clean Architecture)

| Layer | Folder | Depends on | Contains |
|---|---|---|---|
| Domain | `lib/domain` | nothing (pure Dart) | Entities, enums, repository interfaces, business services (scoring, insights, reports, duplicates, template rendering, followup bucketing, productivity score, card parsing, motivation picker) |
| Data | `lib/data` | domain | Hive data sources, repository implementations, Firestore/Storage sync, backup ZIP, Excel/PDF export, sample data |
| Application | `lib/providers` | domain, data | Riverpod providers that wire repositories and expose streams and derived view-models |
| Presentation | `lib/features`, `lib/core/widgets` | application, domain | Screens, sheets, dialogs, reusable glass widgets |
| Core / platform | `lib/core` | — | Theme, constants, utils, platform services (notifications, security, launcher, permissions, analytics) |

**Rule:** `domain` never imports Flutter, Hive or Firebase. Every rule worth testing lives there,
so `flutter test` exercises the business logic without a device.

## 3. Key design decisions

| # | Decision | Alternatives considered | Why |
|---|---|---|---|
| D1 | **Hive CE** (maintained fork of Hive, same API) with **JSON maps** per record, no code generation | Isar, Drift, Hive with adapters | Fast key-value store, encryption built in, no `build_runner` step to break CI, schema evolution by tolerant `fromMap` |
| D2 | **Riverpod 3** with `StreamProvider`s over `box.watch()` | Bloc, Provider | Reactive by default, testable, no `BuildContext` in logic |
| D3 | **Encryption always on** (AES-256 key in Keystore-backed secure storage) | Encrypt only after 5 failures | Encrypting only after an attack means plaintext sits on disk until then. Always-on costs nothing noticeable. On lockout the boxes are closed and the key is evicted from memory |
| D4 | **Firebase options injected by `--dart-define-from-file`** instead of `google-services.json` | flutterfire-generated file committed | Keeps secrets out of git; the app builds and runs with no Firebase project (offline mode) |
| D5 | **Anonymous Firebase Auth** to get a stable uid | Email login | Single user, zero friction; security rules restrict data to `request.auth.uid` |
| D6 | **Last-write-wins** sync on `updatedAt`, soft deletes (`deleted=true`) | CRDT, server timestamps | One user on one or two devices; LWW is predictable and simple |
| D7 | **On-device ML Kit OCR** for business cards | Cloud Vision | Works offline, no data leaves the phone |
| D8 | **Lifecycle heuristic** for the after-call popup | `READ_PHONE_STATE` call-state listener | Avoids a sensitive permission and Play policy review; works on Android 14+ |
| D9 | **Navigator 1 + `IndexedStack` shell** | go_router | Six fixed tabs plus pushes; tab state survives switches; fewer moving parts |

## 4. Runtime sequence

### 4.1 Cold start
```
main() → bootstrap():
  WidgetsFlutterBinding · timezone init · Firebase.initializeApp (only if configured)
  Crashlytics hooks (FlutterError + PlatformDispatcher) · NotificationService.init
  Workmanager.initialize(callbackDispatcher) · register periodic sync (15 min) + daily backup
  runApp(ProviderScope(AnjaliApp))
AnjaliApp → SplashScreen (logo animation ~1.6 s)
  → not onboarded ? OnboardingScreen : LockScreen
LockScreen → (biometric | PIN | pattern) success → VaultController.open() → Hive boxes opened with cipher
  → MainShell → MotivationDialog (random, no repeat in 30) → Home
```

### 4.2 Save a lead
```
ClientForm.save → DuplicateDetector(phone/email) ─ match? → dialog (Open | Merge | Save anyway)
  → ClientRepository.upsert(updatedAt=now, dirty=true)
  → ActivityRepository.add(created / status change)
  → FollowupRepository.upsert (if a followup date is set) → NotificationService.scheduleFollowup (4 reminders)
  → SyncService.requestSync() (debounced 5 s; no-op if offline or unconfigured)
```

### 4.3 Sync
```
trigger: connectivity restored | app resumed | Workmanager 15-min periodic | manual
  ensureSignedIn (anonymous) → for each collection:
    push: records with dirty=true → Firestore set(merge) → dirty=false
          attached local files not yet uploaded → Storage put → remotePath saved
    pull: query updatedAt > lastPulledAt → merge if remote.updatedAt > local.updatedAt
  lastPulledAt = max(updatedAt seen)
```

### 4.4 After-call outcome
```
CallController.call(client) → saves pendingCall{clientId, startedAt} → launch tel:
App lifecycle resumed && pendingCall && now-startedAt > 3 s → CallOutcomeSheet
  → CallLogRepository.add · StatusAutomation.apply(outcome) · optional followup
```

## 5. Folder structure

```
anjali-crm-ai/
├── android/                         # Gradle, manifest, signing, icons
├── assets/
│   ├── backgrounds/                 # bg_gold.jpg · bg_blush.jpg · bg_lotus.jpg (tab backgrounds)
│   ├── icon/                        # app_icon.png · app_icon_foreground.png (launcher sources)
│   ├── images/                      # logo.jpg · logo_round.png
│   └── lottie/                      # success.json · empty.json · heart.json
├── config/
│   └── firebase.example.json        # copy to firebase.json (git-ignored) with your project keys
├── docs/                            # 01–07 design documents
├── firebase/                        # firestore.rules · storage.rules · firestore.indexes.json
├── lib/
│   ├── main.dart                    # entry point
│   ├── bootstrap.dart               # platform init (Firebase, notifications, workmanager)
│   ├── app.dart                     # MaterialApp, theme, root navigator
│   ├── background/
│   │   └── background_tasks.dart    # Workmanager callbackDispatcher (sync + daily backup + missed reminders)
│   ├── core/
│   │   ├── config/                  # app_config.dart · firebase_config.dart
│   │   ├── constants/               # app_assets.dart · motivation_messages.dart
│   │   ├── security/                # crypto_utils · secure_store · vault_key_manager · intruder_camera
│   │   ├── services/                # notification · launcher · permission · analytics · connectivity · file_storage
│   │   ├── theme/                   # app_colors · app_theme
│   │   ├── utils/                   # date_utils · formatters · phone_utils · validators · id
│   │   └── widgets/                 # glass_card · tab_background · stat_card · status_chip · avatar …
│   ├── domain/
│   │   ├── entities/                # client · product · followup · call_log · voice_note · client_document
│   │   │                            # activity · whatsapp_template · user_profile · security_event · enums
│   │   ├── repositories/            # repository interfaces
│   │   └── services/                # lead_scoring · insights_engine · report_engine · duplicate_detector
│   │                                # template_renderer · followup_bucketer · productivity_calculator
│   │                                # motivation_picker · business_card_parser · status_automation
│   ├── data/
│   │   ├── local/                   # hive_service (boxes + cipher) · hive_repository (generic CRUD)
│   │   ├── repositories/            # concrete repositories
│   │   ├── remote/                  # sync_service (Firestore + Storage)
│   │   ├── backup/                  # backup_service (ZIP, rotate 7, restore)
│   │   ├── export/                  # excel_exporter · pdf_exporter
│   │   └── seed/                    # sample_data · default_templates · default_products
│   ├── providers/                   # Riverpod wiring + derived view models
│   └── features/
│       ├── splash/  lock/  onboarding/  motivation/  shell/
│       ├── home/  clients/  add_lead/  followups/  reports/  settings/
│       └── calls/  whatsapp/  voice_notes/  documents/  maps/  search/  card_scanner/  contacts/
├── test/                            # unit + widget tests
├── scripts/                         # test.sh · build_release.sh · gen_keystore.sh
├── pubspec.yaml
└── README.md
```

## 6. Cross-cutting concerns

| Concern | Implementation |
|---|---|
| Errors | Repositories throw typed `AppException`; UI shows snackbars; uncaught errors go to Crashlytics (when configured) and `debugPrint` |
| Logging | `AppLog` wrapper; no PII in production logs |
| Analytics | Screen views + counts only (e.g. `lead_created{product}`), never names or phones |
| Permissions | `PermissionService.ensure(Permission)` with rationale dialog and a "Open settings" fallback |
| Theming | Material 3, seed `#6C63FF`, secondary `#FF6B9D`, background `#F8FAFC`; dark scheme; glass = `BackdropFilter` blur 18 + 60–72% surface tint |
| Responsiveness | `LayoutBuilder` breakpoints at 360 / 600 dp; KPI grid 2→3→4 columns; text scale clamped 0.85–1.3 |
| Time zones | `timezone` + device zone from `flutter_timezone`; all stored times are UTC ISO-8601 |
