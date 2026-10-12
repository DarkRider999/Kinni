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
| **Clients** | Full lead form, phonebook import (multi-number, avatar), business-card OCR (on-device), GPS on a map, rich profile with timeline, voice notes, document vault, calls, followups, PDF profile. Profile quick actions: Call · WhatsApp · Vault · Scan · Upload · Edit |
| **Client list** | Swipe right = WhatsApp, swipe left = Edit, long-press = change status. Quick filters: Credit Card, Loan, Approved, Rejected, Awaiting Documents, Not Interested, Follow Up, Today, This Week, This Month; plus salary range, company, location, product, status, priority |
| **Smart search** | Name, phone, WhatsApp, company, location, product, status, and salary ranges (`10k-20k`, `>15k`, `<8000`); instant results |
| **Duplicates** | Phone, WhatsApp, and name + phone checks. "Potential Duplicate Customer Found" → View Existing Record / Merge / Continue Anyway / Cancel |
| **Status colours** | Approved green · Follow up / new orange · Interested blue · Awaiting documents purple · Rejected red · Not eligible grey · Not interested black |
| **WhatsApp** | A WhatsApp icon in front of every phone number opens a direct `wa.me` chat. Long-press (or the profile button) opens the sheet: share client details (name, phone, product, status, remarks) or send a template in one tap. Every send is logged on the timeline |
| **Message templates** | Settings → Message Templates: unlimited templates; create, edit, duplicate, delete, reorder, set default. Tags `{CustomerName} {ProductName} {Phone} {Location} {Salary} {Status} {FollowupDate}` with live preview. Defaults: Follow Up, Documents Required, Approved, Rejected, General Greeting |
| **Read aloud (TTS)** | Free, offline Android text-to-speech (flutter_tts): play / pause / resume / stop, speed, language and voice (Settings → Voice & Speech). Reads notes, transcripts, followup notes, remarks and messages; a mini player stays on screen while speaking |
| **Calls** | Click-to-call; on return an outcome sheet (Interested / Call back / No answer / Rejected / Wrong number) updates the CRM automatically |
| **Followups** | Today · Tomorrow · This week · Upcoming · Overdue · Completed. Reminders 24 h / 3 h / 1 h / at time (configurable). Missed-followup alerts |
| **Document vault** | Per-client vault in folders (Passport, Emirates ID Front/Back, Visa, Salary Certificate, Bank Statement, Credit Card Form, Loan Application Form, Company Trade License, Other; admin can add, rename, delete and reorder). Add by free document scanner (auto-crop, edge detection, enhancement → PDF), gallery multi-select, PDF / Files, WhatsApp folder, or **Share → Anjali CRM** from WhatsApp. PDF/JPG/JPEG/PNG/WEBP. Preview with zoom, rotate, fullscreen, page navigation. View · Rename · Replace · Download · Share · Move · Delete · Note · Verify. Status Pending (grey) / Requested (orange) / Received (blue) / Verified (green) / Rejected (red) / Expired. Per-product checklist with completion %. Expiry reminders 30/15/7/1 days before. Files AES-256-GCM encrypted, readable only after login |
| **OCR** | Free on-device ML Kit: extracts name, Emirates ID number, passport number (incl. MRZ), salary and full text; you edit it before it is saved to notes |
| **Voice notes** | Record, pause, resume, discard, save; play back; dictate; read transcripts aloud |
| **Reports** | By month, product, status, location, salary range, lead source. Approval / rejection / conversion %, avg followups. Excel (6 sheets) and PDF, shared via WhatsApp / email or saved |
| **Backup & sync** | Automatic daily ZIP backup (keeps 7), manual backup / restore / export of clients, products, followups, templates, categories, settings and documents. Vault files are re-encrypted with the device key on restore, so a backup survives a reinstall or a new phone. Firebase Firestore + Storage sync when online, with a Synced / Pending Sync / Sync Failed badge on Home and Settings |

Everything uses free, open-source or on-device components: no paid AI, OCR or text-to-speech services.

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

## Get the APK from GitHub Actions

Every push that touches `anjali-crm-ai/` runs `.github/workflows/anjali-crm-ai.yml`: analyze → tests →
`flutter build apk --release`. Open the run under **Actions → Anjali CRM AI** and download
**anjali-crm-ai-apk** from *Artifacts*. You can also start it by hand with *Run workflow*.

Without signing secrets the APK is signed with a debug key: fine to install and test (enable
"Install unknown apps"), not for the Play Store. For a real release, add the repository secrets
`ANJALI_KEYSTORE_BASE64`, `ANJALI_KEYSTORE_PASSWORD` and `ANJALI_KEY_ALIAS`, plus optionally
`ANJALI_FIREBASE_JSON` and `MAPS_API_KEY`.

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

`flutter test` runs 49 tests covering the template renderer, salary-range search, document checklist and expiry, ID/passport/salary text extraction, WhatsApp and name+phone duplicates, the AES-GCM file vault, the motivation picker (no repeats), phone normalisation,
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
