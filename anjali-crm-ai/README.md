# Anjali CRM AI

> **Never Miss A Lead Again**: a personal, offline-first Android CRM built for one sales
> executive, Anjali, who sells loans, credit cards and insurance.

Flutter · Clean Architecture · Riverpod 3 · Hive (AES-256) · Firebase (optional) · Material 3 glassmorphism

---

## What it does

| Area | Highlights |
|---|---|
| **Security** | Fingerprint / face, 6-digit PIN, 3×3 pattern. Auto-lock after inactivity. Recovery code. After 5 wrong attempts: intruder photo, time logged, escalating lockout, and the encrypted vault is closed. All data is AES-256 encrypted at rest, with the key held in Android Keystore. |
| **Daily motivation** | After every unlock, a random message from 100 (universe / healing / positivity). No repeat within 30. Closed only with a beating heart ♥ |
| **Home** | Greeting with profile photo, 13 KPI cards (tap to drill down), productivity (today / weekly / monthly score), AI recommendations, today's tasks, 5 charts (funnel, monthly, product, approval gauge, status pie), activity feed |
| **Clients** | Full lead form, phonebook import (multi-number, avatar), business-card OCR (on-device), GPS on a map, duplicate detection (phone/email) with merge, rich profile with timeline, voice notes, documents, calls, followups, PDF profile |
| **WhatsApp** | A WhatsApp icon in front of every phone number opens a direct chat (logged on the timeline) |
| **Calls** | Click-to-call; on return an outcome sheet (Interested / Call back / No answer / Rejected / Wrong number) updates the CRM automatically |
| **Followups** | Today · Tomorrow · This week · Upcoming · Overdue · Completed. Reminders 24 h / 3 h / 1 h / at time (configurable). Missed-followup alerts |
| **Documents** | Emirates ID, Passport, Visa, Salary Certificate, Bank Statement, Labour Contract + custom. Pending/Received/Verified/Rejected. Camera, image or PDF |
| **Reports** | By month, product, status, location, salary range, lead source. Approval / rejection / conversion %, avg followups. Excel (6 sheets) and PDF, shared via WhatsApp / email or saved |
| **Backup & sync** | Automatic daily ZIP backup (keeps 7), manual backup/restore/export, Firebase Firestore + Storage sync when online |

Design documents are in [`docs/`](docs): requirements, architecture, database, wireframes, user flows and API design.

## Project layout

```
lib/
  main.dart · bootstrap.dart · app.dart
  background/            WorkManager: 15-min sync + missed reminders, daily backup
  core/                  config, constants (motivation messages), security, services, theme, utils, widgets
  domain/                entities, repository contract, pure business rules (scoring, insights, reports, …)
  data/                  Hive repositories, sync, backup, Excel/PDF export, seed + sample data
  providers/             Riverpod wiring, CRM use-cases (crm_actions), lock controller
  features/              gate, splash, lock, onboarding, motivation, shell, home, clients, followups,
                         reports, search, settings, calls, whatsapp, voice_notes, documents, maps, card_scanner
test/                    unit tests (domain + encrypted Hive repo) and widget tests
android/                 manifest, permissions, signing, R8 rules, launcher icons
firebase/                Firestore + Storage security rules
scripts/                 test.sh · gen_keystore.sh · build_release.sh
```

## Requirements

* Flutter **3.47.x stable** (Dart 3.13) · Android SDK 36 · JDK 17
* Android device/emulator **7.0 (API 24)** or newer

## Build & run

```bash
cd anjali-crm-ai
flutter pub get
flutter run                     # debug on a connected device
./scripts/test.sh               # analyzer + all tests
```

### Optional: Google Maps key
Map picking needs a Maps SDK for Android key. Without it, the map view is blank,
but "Navigate" still opens Google Maps. Add it to `android/local.properties`:
```
MAPS_API_KEY=AIza...
```

### Optional: Firebase (cloud sync, Crashlytics, Analytics)
The app runs fully offline without Firebase. To enable sync:

1. Create a Firebase project and add an **Android app** with package `com.anjalicrm.anjali_crm_ai`.
2. Enable **Authentication → Anonymous**, **Firestore**, **Storage**, **Crashlytics** and **Analytics**.
3. Deploy the security rules: `cd firebase && firebase deploy --only firestore:rules,storage`.
4. Copy `config/firebase.example.json` to `config/firebase.json` (git-ignored) and fill in the values from
   *Project settings → Your apps* (API key, App ID, sender ID, project ID, storage bucket).
5. Run or build with the config:
   ```bash
   flutter run --dart-define-from-file=config/firebase.json
   ```

No `google-services.json` is needed: options are injected at build time, so no secrets live in git.

## Release signing & APK

```bash
./scripts/gen_keystore.sh          # once: creates anjali-release.jks + android/key.properties
# edit android/key.properties with your passwords
./scripts/build_release.sh         # tests, then signed split APKs + AAB (obfuscated)
```

Or manually:
```bash
flutter build apk --release --split-per-abi --obfuscate --split-debug-info=build/symbols \
  --dart-define-from-file=config/firebase.json
# → build/app/outputs/flutter-apk/app-arm64-v8a-release.apk
```

**Back up `anjali-release.jks` and its passwords.** Without them you cannot publish updates.
Keep `build/symbols` to de-obfuscate crash reports.

## Permissions (and why)

| Permission | Used for |
|---|---|
| Camera | Business-card scan, document scan, intruder photo |
| Microphone | Voice notes, speech-to-text, voice search |
| Contacts | Import a lead from the phonebook |
| Location | Save a client's GPS position |
| Notifications, exact alarms, boot | Followup reminders that survive reboot |
| Biometric | Fingerprint / face unlock |
| Internet / network state | Cloud sync, maps, backup upload |

`allowBackup` is disabled and data-extraction rules exclude everything, so customer data never
leaves the phone via Android cloud backup.

## Sample data

Onboarding offers to load 30 realistic demo leads. You can clear them later in
**Settings → Sample data**; real leads are never touched.

## Testing

`flutter test` runs 33 tests covering the motivation picker (no repeats), phone normalisation,
duplicate detection and merge, lead scoring, AI insights, followup bucketing, KPIs and grouping,
call-outcome automation, business-card parsing, PBKDF2 (RFC 7914 vector), lockout policy, PIN rules,
the encrypted Hive repository (round trip, dirty tracking, soft delete, search) and the heart-close
motivation dialog.

## Security model (summary)

* PIN, pattern and recovery code are stored only as PBKDF2-HMAC-SHA256 hashes (120k iterations,
  random salt) in Keystore-backed secure storage.
* All CRM boxes are AES-256 encrypted with a random 256-bit key in secure storage.
* Failed attempts made while the vault is locked are queued and written to the encrypted
  security log on the next successful unlock.
* Firestore and Storage rules restrict every document and file to the signed-in anonymous uid.
