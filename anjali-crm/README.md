# Anjali CRM AI

Offline-first Flutter CRM for Android. Package: `com.anjali.crm.ai`, version `1.0.0+1`.

## What the app does today
Milestone 1 of the user guide (`Anjali-CRM-AI-User-Guide.pdf`), the lead CRM core:

| Guide section | Built |
|---|---|
| §4 Navigation | Home, Clients, Add Lead, Followups (red overdue badge), Settings |
| §5 Home | Greeting, tappable pipeline cards for every status, followups today, overdue, conversions and AED disbursed this month; Today's tasks with Call, WhatsApp, Mark complete |
| §6 Clients | Search; status chips; product and priority filters; sort by recently updated, name, lead score, next followup; call button; swipe right = WhatsApp, left = Edit; long-press = change status |
| §7 Add/edit lead | All contact, work & finance and lead fields; name and phone required; WhatsApp-same-as-phone; schedule followup; duplicate phone warning (View existing / Continue anyway / Cancel) matching any number format |
| §8 Client profile | Header with lead score circle, amounts in AED; Call, WhatsApp, Email, Map; pipeline bar; Change status (asks for AED amount on Approved/Disbursed); Timeline with notes; delete client |
| §13 Calls & followups tabs | Call now → "How did the call go?" outcome logging; call back creates a followup; wrong-number warning; add/complete/reschedule/delete followups |
| §15 Followups | Today, Tomorrow, This Week, Upcoming, Overdue, Completed; Call, Reschedule, Mark complete with outcome, Reopen, Delete; new followup with client search |
| §16 Search | Name, phone in any format (local or international, partial), company, location, product, status, salary |
| §22 Products | The six default products and their required documents are stored (editing them comes later) |

Lead score is a transparent rule (see `lib/data/lead_score.dart`), not a model.

Updating from the first version keeps all data: every contact becomes a New Lead and every activity
a followup (database version 2 migration, covered by a test).

Also: every screen shows an error with **Retry** if the database cannot be read; customer data is
excluded from Google cloud backup; only the `USE_BIOMETRIC` permission is requested.

### Not built yet (later milestones)
PIN/pattern lock, setup wizard and recovery code (§2, §3, §27) · document vault, scanning, WhatsApp
import and OCR (§10–12, §14) · message templates (§19, §24) · reports and Excel/PDF export (§17, §28) ·
reminder notifications (§25) · voice notes, dictation and read-aloud (§9, §26) · map picker (§18) ·
product and folder editing (§22, §23) · backup/restore (§29) · cloud sync (§30) · sample data (§31) ·
encryption at rest (§32).

## Toolchain
Flutter 3.50.1 stable (Dart 3.12), JDK 17, Android SDK platform 36. `flutter doctor -v` must be clean
for Android.

## Build, test and run
```bash
cd anjali-crm
flutter pub get
flutter analyze          # must report "No issues found"
flutter test             # unit, database and widget tests
flutter run              # on a connected device or emulator
flutter build apk --release
```

Release signing reads `android/key.properties` (see `key.properties.example` and `RELEASE.md`).
Without it the release APK is signed with the local **debug** key and Gradle prints a warning:
that APK installs, but a later build signed with a different key will not install over it.

## Continuous integration
`.github/workflows/anjali-crm-ai.yml` (workflow **Anjali CRM AI**) runs analyze, tests and a release
build on every change under `anjali-crm/`, and uploads the APK as the artifact **anjali-crm-ai-apk**.
To sign CI builds with the real release key, add these repository secrets:

| Secret | Value |
|---|---|
| `ANJALI_KEYSTORE_BASE64` | `base64 -w0 upload-keystore.jks` |
| `ANJALI_KEYSTORE_PASSWORD` | keystore password |
| `ANJALI_KEY_PASSWORD` | key password |
| `ANJALI_KEY_ALIAS` | key alias (for example `upload`) |

Until they are set, CI builds are debug-signed and the run summary says so.

## Permissions policy
The manifest requests only `USE_BIOMETRIC`. Add a permission in the same change as the feature that
uses it, and request sensitive permissions at the point of use.
