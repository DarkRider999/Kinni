# 01 · Functional Requirements: Anjali CRM AI

> **Tagline:** Never Miss A Lead Again
> **Product owner:** Anjali (single user, sales executive: loans, cards, insurance)
> **Platform:** Android (phones, 5"–7", API 24+), offline-first, optional cloud sync

## 1. Product vision

A **personal** CRM that runs entirely on Anjali's phone. Every lead, call, document,
WhatsApp message and followup lives in one place. Reminders do the remembering.
Local "AI" scoring tells her who to call next.

### Personas (team perspectives)

| Lens | Question it answers | Requirement it drives |
|---|---|---|
| Executive | Is Anjali converting more leads? | KPI dashboard, monthly score, conversion % |
| Business user (Anjali) | Who do I call right now? | Today tasks, AI recommendations, one-tap call/WhatsApp |
| Solution architect | Will it survive no network and a lost phone? | Offline-first Hive, encrypted at rest, cloud sync, backups |
| Engineer | Can it be changed safely? | Clean architecture, Riverpod, tests on business rules |
| End user | Is it pleasant to use 100× a day? | Glass UI, soft personal backgrounds, ≤2 taps to act |

## 2. Requirement catalogue

Priority: **M** = must (v1.0), **S** = should (v1.0 if time), **C** = could (v1.1).

### FR-SEC: Security
| ID | Requirement | Pri |
|---|---|---|
| SEC-01 | Splash shows logo, "Anjali CRM AI", tagline | M |
| SEC-02 | Unlock by fingerprint / face (when the device supports it) | M |
| SEC-03 | Unlock by 6-digit PIN (PBKDF2-SHA256, 120k iterations, random salt) | M |
| SEC-04 | Unlock by 3×3 pattern (min 4 dots, hashed like the PIN) | M |
| SEC-05 | Auto-lock after inactivity (1/2/5/10/30 min, default 5) and when backgrounded past the timeout | M |
| SEC-06 | Change PIN, change pattern, toggle biometrics | M |
| SEC-07 | Recovery code (12 chars) shown once at onboarding; it resets the PIN ("backup security") | M |
| SEC-08 | Every failed attempt is counted and logged with a timestamp | M |
| SEC-09 | 5 failed attempts: front-camera intruder photo, lockout 30 s, doubling to 30 min max | M |
| SEC-10 | All local data AES-256 encrypted at rest (Hive cipher, key in Android Keystore via secure storage). On lockout the vault is closed and the key is evicted from memory | M |
| SEC-11 | Security log screen (time, type, intruder photo) | S |

### FR-ONB: Onboarding (first launch only)
| ID | Requirement | Pri |
|---|---|---|
| ONB-01 | Wizard steps: Profile photo → Name → Mobile → Theme → PIN (+confirm) → Fingerprint → Products | M |
| ONB-02 | Default products pre-selected: Personal Loan, Business Loan, Mortgage, Credit Card, Auto Loan, Insurance; custom products can be added | M |
| ONB-03 | Optional "Load sample data" so the dashboard is not empty | S |
| ONB-04 | Show the recovery code with copy and "I saved it" confirmation | M |

### FR-MOT: Daily motivation
| ID | Requirement | Pri |
|---|---|---|
| MOT-01 | After each cold-start unlock, show a random message from a library of 100 (universe / healing / positivity) | M |
| MOT-02 | No repeat within the last 30 messages shown (history persisted) | M |
| MOT-03 | Close button is an animated heart | M |
| MOT-04 | Toggle in Settings → Notifications ("Daily motivation") | S |

### FR-NAV: Navigation
Bottom navigation: **Home · Clients · Add Lead · Followups · Reports · Settings**.
Each tab has a soft personal background image (Anjali's photos at 10–16% opacity
under a theme-tinted gradient, so content stays readable).

### FR-HOME: Home dashboard
| ID | Requirement | Pri |
|---|---|---|
| HOME-01 | Time-aware greeting ("Good Morning, Anjali") + profile picture | M |
| HOME-02 | KPI cards: Total, New, Interested, Docs Pending, Submitted, Approved, Rejected, Not Interested, Not Eligible, Followups Today, Overdue, Monthly Conversions, Loan Disbursed (amount) | M |
| HOME-03 | Charts: Lead Funnel, Monthly Performance (6 months), Product Performance, Approval Conversion Rate, Status Distribution | M |
| HOME-04 | Recent activity feed (last 15 events) | M |
| HOME-05 | Today's tasks (followups due today + overdue) with one-tap actions | M |
| HOME-06 | AI recommendations: urgent followups, pending document collection, likely-to-convert leads | M |
| HOME-07 | Daily productivity card: followups done, calls made, conversions, pending, weekly score, monthly score | M |
| HOME-08 | Global search entry point (text + voice) | M |

### FR-CLI: Clients
| ID | Requirement | Pri |
|---|---|---|
| CLI-01 | Add/Edit client with all fields: photo, name, phone, WhatsApp, email, location, GPS, company, job title, nationality, monthly salary, product, lead source, status, followup date+time, remarks, voice notes, documents, rating (1–5), priority | M |
| CLI-02 | Import from phonebook: name, all numbers (choose primary + WhatsApp), avatar | M |
| CLI-03 | Business card scan: camera capture, on-device OCR, extract name / phone / email / company, prefill form | M |
| CLI-04 | Duplicate detection on save by normalised phone or email, with options *Open existing*, *Merge*, *Save anyway* | M |
| CLI-05 | Client list: search, filter by status / product / priority, sort by updated / name / score / followup | M |
| CLI-06 | Soft delete with undo (snackbar, 5 s) | S |

### FR-PRO: Customer profile
Header (photo, name, status chip, score) · actions **Call, WhatsApp, Open Vault, Scan, Upload, Edit** ·
tabs **Timeline · Notes (voice) · Documents · Calls · Followups · Files & Reports**.
Generating a one-client PDF profile report adds it to "Generated Reports".

### FR-WA: WhatsApp direct message
| ID | Requirement | Pri |
|---|---|---|
| WA-01 | A WhatsApp icon in front of every phone number (lists, profile, followups, search) opens a direct chat (`wa.me/<E.164 digits>`) | M |
| WA-02 | Opening a chat is logged as an activity on the client | M |

### FR-CALL: Call management
| ID | Requirement | Pri |
|---|---|---|
| CALL-01 | Click-to-call via the dialer | M |
| CALL-02 | When the app resumes after a call, a popup asks for the outcome: Interested, Call Back, No Answer, Rejected, Wrong Number | M |
| CALL-03 | Outcome automation: Interested → status Interested; Call Back → schedule followup (picker, default +1 day 10:00); No Answer → followup +2 h; Rejected → Not Interested; Wrong Number → flag phone, priority Low | M |
| CALL-04 | Call log stored locally per client | M |

### FR-VOICE: Voice notes
Record unlimited AAC notes · playback with seek · speech-to-text dictation notes ·
transcript attached · date/time stored · delete.

### FR-FUP: Followups
| ID | Requirement | Pri |
|---|---|---|
| FUP-01 | Segments: Today, Tomorrow, This Week, Upcoming, Overdue, Completed | M |
| FUP-02 | Sorted nearest date first (Completed: most recent first) | M |
| FUP-03 | Reminders 24 h, 3 h, 1 h before and at the exact time (offsets configurable) | M |
| FUP-04 | Missed reminder notification once a followup passes due while still pending | M |
| FUP-05 | Actions: Call, WhatsApp, Reschedule, Mark Complete | M |

### FR-DOC: Document management
Required set: Emirates ID, Passport, Visa, Salary Certificate, Bank Statement, Labour Contract
plus unlimited custom documents · statuses Pending / Received / Verified / Rejected ·
sources: camera scan, gallery image, PDF file · open / share / replace / delete.

### FR-APP: Application tracking
Status flow (11): New Lead → Interested → Documents Requested → Documents Received →
Application Submitted → Under Review → Approved → Disbursed, with exits Rejected, Not Eligible,
Not Interested. Every change writes a timeline activity (from → to, timestamp).
Approved and Disbursed capture the amount.

### FR-REP: Reports & export
| ID | Requirement | Pri |
|---|---|---|
| REP-01 | Group by Month, Product, Status, Location, Salary Range, Lead Source | M |
| REP-02 | KPIs: Approval %, Rejection %, Conversion %, Avg followups per lead, Lead-source performance | M |
| REP-03 | Excel export, one sheet each: All Leads, Approved, Rejected, Documents Pending, Followups, Disbursed | M |
| REP-04 | PDF export (KPI summary + tables) | M |
| REP-05 | Share via WhatsApp / Email (system share sheet) or Save to Device | M |

### FR-SRCH: Search
Global search on name, phone, company, salary, location, product, status, with
voice search. Results ranked: exact phone > name prefix > contains.

### FR-MAP: Maps
Pick and save GPS on a map or from the current location · show the client on a map ·
"Navigate" opens Google Maps turn-by-turn.

### FR-BAK: Backup & sync
| ID | Requirement | Pri |
|---|---|---|
| BAK-01 | Automatic daily local backup (ZIP of JSON + files), keep the last 7 | M |
| BAK-02 | Manual backup, restore from file, export (share) backup | M |
| BAK-03 | Firebase sync (Firestore + Storage), last-write-wins on `updatedAt`, background sync when the network returns | M |
| BAK-04 | The app is fully functional with Firebase unconfigured (sync shows "Not configured") | M |

### FR-AI: Local AI insights
High-priority leads · longest-waiting leads · overdue followups · best-performing product ·
best lead source · upcoming opportunities (next 7 days, score ≥ 60).

### FR-SET: Settings
Profile & DP · Theme (light / dark / system) · Security (fingerprint, PIN, pattern, auto-lock,
security log) · Notifications (offsets, motivation) · Backup · Cloud Sync · Product Manager ·
Export Data · Sample data · App Info.

## 3. Non-functional requirements

| Area | Target |
|---|---|
| Performance | Cold start to lock screen < 2 s on a mid-range device; lists of 5,000 clients scroll at 60 fps (`ListView.builder`) |
| Offline | 100% of features except cloud sync, maps tiles and OCR-model download work with no network |
| Security | AES-256 at rest, no PII in analytics events, Crashlytics without user data, `allowBackup=false` |
| Accessibility | Text scale up to 1.3× without overflow, 48 dp touch targets, contrast ≥ 4.5:1 on glass cards |
| Reliability | Every write is atomic per record; sync is idempotent; restore validates the manifest before wiping data |
| Maintainability | Clean layering; business rules are pure Dart and unit-tested |

## 4. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Android 12+ exact-alarm restrictions | Reminders late | Request `SCHEDULE_EXACT_ALARM`; fall back to inexact-allow-while-idle; missed-reminder sweep on resume and in background |
| Android 14+ blocks call-state reading | Cannot auto-detect the call end | Resume-after-dial heuristic (app lifecycle) to trigger the outcome popup |
| `record` and `speech_to_text` both need the microphone | Simultaneous recording + STT fails | Separate "Record" and "Dictate" modes; dictation stores the transcript |
| Lost phone | Data loss | Daily backup + optional Firebase sync + recovery code |
| PII in backups | Leakage when shared | Backups stay app-private; export shows a warning; cloud data is under a uid-scoped security rule |
| Firebase keys are environment-specific | Build breaks without config | Options injected via `--dart-define-from-file`; the app degrades gracefully |


## Addendum: additional requirements (v1.1)

Everything here uses free, open-source or on-device components. Relationship memory, emotional AI,
behavioural profiling and AI customer memory are explicitly out of scope.

| ID | Requirement | Where |
|---|---|---|
| WA-02 | WhatsApp sheet: open the chat, share client details (name, phone, product, status, remarks), send a template in one tap; every send is logged on the timeline | `features/whatsapp/whatsapp_button.dart` |
| TPL-01 | Settings → Message Templates: unlimited; create, edit, delete, duplicate, set default, reorder | `features/settings/message_templates_screen.dart` |
| TPL-02 | Tags {CustomerName} {ProductName} {Phone} {Location} {Salary} {Status} {FollowupDate}; unknown tags stay visible | `domain/services/template_renderer.dart` |
| TPL-03 | Defaults: Follow Up, Documents Required, Approved, Rejected, General Greeting | `data/seed/defaults.dart` |
| TTS-01 | Offline Android TTS: play, pause, resume, stop, speed, voice, language; reads notes, followup notes, remarks and messages | `core/services/tts_service.dart`, `features/tts/` |
| VN-01 | Voice notes: record, pause, resume, discard, save to the client, timeline entry | `features/voice_notes/voice_notes_tab.dart` |
| SCN-01 | Free document scanner (auto-crop, edge detection, enhancement) → PDF into the vault | `features/documents/documents_tab.dart`, `data/export/scan_pdf.dart` |
| OCR-01 | ML Kit OCR: name, Emirates ID, passport number (including MRZ), salary, full text; the user edits it before it is saved to notes | `domain/services/document_text_parser.dart` |
| VLT-01 | A vault per client, with categories the admin manages (add, rename, delete, reorder) | `features/settings/document_categories_screen.dart` |
| VLT-02 | Add by scan, gallery multi-select, PDF/Files, WhatsApp folder or the Android share target; PDF, JPG, JPEG, PNG, WEBP | `documents_tab.dart`, `shell/main_shell.dart`, AndroidManifest |
| VLT-03 | Preview with zoom, rotate, fullscreen and page navigation | `features/documents/document_preview_screen.dart` |
| VLT-04 | Actions: view, rename, replace, download, share, move, delete, add note, mark verified | `documents_tab.dart` |
| VLT-05 | Statuses Pending, Requested, Received, Verified, Rejected, Expired, each with its colour | `core/theme/app_colors.dart` |
| VLT-06 | Checklist per product with completion %; Home counts awaiting, completed, pending and expiring | `domain/services/document_checklist.dart`, `home_screen.dart` |
| VLT-07 | Expiry reminders 30, 15, 7 and 1 days before; expired documents swept on unlock | `core/services/notification_service.dart` |
| VLT-08 | Files AES-256-GCM encrypted and readable only after unlock; Firebase Storage sync; offline access | `core/security/file_vault.dart` |
| TL-01 | Timeline entries: lead created, WhatsApp sent, status changed, followup added/completed, document uploaded, voice note added, application submitted/approved | `providers/crm_actions.dart` |
| SRC-02 | Search by WhatsApp number and by salary range (`10k-20k`, `>15k`) | `data/repositories/repositories.dart` |
| FLT-01 | Quick filters, plus salary range, company and location | `features/clients/client_list_screen.dart` |
| DUP-02 | Phone, WhatsApp, name + phone. "Potential Duplicate Customer Found" → View Existing Record / Continue Anyway / Cancel (plus Merge) | `client_form_screen.dart` |
| UX-01 | Swipe right = WhatsApp, swipe left = Edit, long-press = change status | `client_list_screen.dart`, `clients/status_sheet.dart` |
| SYN-02 | Synced / Pending Sync / Sync Failed indicator | `features/sync/sync_status_chip.dart` |
| BAK-03 | Backups hold templates, categories, settings, document metadata and files; vault files survive a reinstall | `data/backup/backup_service.dart` |
