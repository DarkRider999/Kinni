# 03 · Database Design

## 1. Storage engines

| Store | Technology | Purpose |
|---|---|---|
| Local primary | Hive CE boxes, AES-256 (`HiveAesCipher`) | Source of truth on the device |
| Secrets | `flutter_secure_storage` (Android Keystore / EncryptedSharedPreferences) | Vault key, PIN hash, pattern hash, recovery-code hash, salts |
| Files | App documents dir `files/{clientId}/…` | Photos, voice notes (`.m4a`), documents (images / PDF), generated reports |
| Cloud mirror | Firestore `users/{uid}/{collection}/{id}` | Sync + cross-device restore |
| Cloud files | Storage `users/{uid}/files/{clientId}/{fileName}` | Attachment backup |

Each Hive box stores `Map<String, dynamic>` JSON values keyed by the record id (UUID v4).
Entities serialise themselves with `toMap()` / `fromMap()`; `fromMap` tolerates missing keys so
older records keep loading after the schema grows.

## 2. Common sync columns (every syncable record)

| Field | Type | Notes |
|---|---|---|
| `id` | String (UUID v4) | Primary key = Hive key = Firestore doc id |
| `createdAt` | ISO-8601 UTC | |
| `updatedAt` | ISO-8601 UTC | LWW conflict key |
| `deleted` | bool | Soft delete; purged locally 30 days after sync |
| `dirty` | bool | Local only; `true` until pushed (never written to Firestore) |

## 3. Boxes / collections

### `clients`
| Field | Type | Rules |
|---|---|---|
| name | String | required, 2–80 chars |
| phone | String | required; stored as typed; `phoneKey` = normalised digits (last 9 for UAE mobiles, E.164 otherwise) |
| phoneKey | String | index for duplicates and search |
| whatsapp | String? | defaults to phone |
| email | String? | lower-cased; `emailKey` for duplicates |
| photoPath | String? | local file path |
| location | String? | free text area / emirate |
| latitude, longitude | double? | GPS |
| company, jobTitle, nationality | String? | |
| monthlySalary | double? | AED |
| productId | String? | FK → products |
| leadSource | enum `LeadSource` | referral, walkIn, coldCall, whatsapp, socialMedia, website, existingCustomer, event, other |
| status | enum `LeadStatus` | 11 states (see §4) |
| priority | enum `Priority` | low, medium, high, urgent |
| rating | int 0–5 | |
| nextFollowupAt | DateTime? | denormalised from the nearest pending followup |
| remarks | String? | |
| requestedAmount | double? | |
| approvedAmount | double? | set on Approved |
| disbursedAmount | double? | set on Disbursed |
| statusChangedAt | DateTime | for "longest waiting" |
| wrongNumber | bool | set by the call outcome |

### `products`
`name` (unique, case-insensitive) · `iconCode` (int, Material icon code point) · `colorValue` (int ARGB) ·
`active` (bool) · `sortOrder` (int).

### `followups`
`clientId` FK · `dueAt` DateTime · `note` · `status` enum `FollowupStatus {pending, completed, cancelled}` ·
`completedAt` · `missedNotified` bool · `notificationBaseId` int (31-bit hash of the id; 4 reminder ids = base+0..3).

### `call_logs`
`clientId` · `calledAt` · `outcome` enum `CallOutcome {interested, callBack, noAnswer, rejected, wrongNumber}` · `note` · `durationSeconds` (user-entered, optional).

### `voice_notes`
`clientId` · `filePath?` (null for dictation-only notes) · `durationMs` · `transcript?` · `remotePath?`.

### `documents`
`clientId` · `type` enum `DocumentType {emiratesId, passport, visa, salaryCertificate, bankStatement, labourContract, custom}` ·
`customName?` · `status` enum `DocumentStatus {pending, received, verified, rejected}` · `filePath?` · `mimeType?` · `remotePath?` · `note?`.
Uniqueness: one row per (clientId, type) except `custom`.

### `activities` (timeline, append-only)
`clientId?` · `type` enum `ActivityType {created, updated, statusChanged, call, whatsapp, followupScheduled, followupCompleted, document, voiceNote, merged, report}` ·
`title` · `detail?` · `fromStatus?` · `toStatus?` · `at`.


### `security_events` (local only, never synced)
`type` enum `SecurityEventType {unlockSuccess, failedPin, failedPattern, failedBiometric, lockout, pinChanged, recoveryUsed}` · `at` · `photoPath?` · `detail?`.

### `settings` (key/value, local only)
| Key | Type | Default |
|---|---|---|
| `profile` | Map (UserProfile: name, mobile, photoPath) | — |
| `onboarded` | bool | false |
| `themeMode` | `system` · `light` · `dark` | system |
| `biometricEnabled` | bool | false |
| `patternEnabled` | bool | false |
| `autoLockMinutes` | int | 5 |
| `reminderOffsetsMinutes` | List<int> | [1440, 180, 60, 0] |
| `motivationEnabled` | bool | true |
| `motivationHistory` | List<int> | [] (last 30 indexes) |
| `cloudSyncEnabled` | bool | true |
| `lastPulledAt` | ISO string | — |
| `lastBackupAt` | ISO string | — |
| `failedAttempts` | int | 0 |
| `lockoutUntil` | ISO string | — |
| `lockoutLevel` | int | 0 |
| `pendingCall` | Map {clientId, startedAt} | — |

## 4. Status flow (state machine)

```
NEW_LEAD → INTERESTED → DOCUMENTS_REQUESTED → DOCUMENTS_RECEIVED → APPLICATION_SUBMITTED
        → UNDER_REVIEW → APPROVED → DISBURSED
any open state → REJECTED | NOT_ELIGIBLE | NOT_INTERESTED      (closed-lost)
closed-lost → INTERESTED                                        (re-open)
```
- **Open** = everything except Approved, Disbursed, Rejected, Not Eligible, Not Interested.
- **Converted** = Approved or Disbursed. **Monthly conversions** = clients whose `statusChangedAt`
  falls in the current month and whose status is converted.
- **Documents pending** = status in {Documents Requested, Documents Received} OR any required document still `pending`.
- Backwards moves are allowed (data correction) but always logged in `activities`.

## 5. Entity–relationship

```
products 1 ──< clients 1 ──< followups
                  │  1 ──< call_logs
                  │  1 ──< voice_notes
                  │  1 ──< documents
                  │  1 ──< activities
security_events (independent, local)   settings (kv, local)
```

## 6. Derived metrics (computed, never stored)

| Metric | Formula |
|---|---|
| Approval % | (Approved + Disbursed) ÷ (Approved + Disbursed + Rejected + Not Eligible) |
| Rejection % | Rejected ÷ decided (same denominator) |
| Conversion % | (Approved + Disbursed) ÷ total leads |
| Avg followups | completed followups ÷ leads that have at least one followup |
| Lead score (0–100) | status weight (0–35) + priority (0–20) + rating (0–15) + salary band (0–10) + document completeness (0–10) + recency (0–10) − overdue penalty (0–15) |
| Weekly score | min(100, completed followups×4 + calls×2 + conversions×15 + docs received×3) over 7 days |

## 7. Firestore layout and indexes

```
users/{uid}
  ├── clients/{id}        ├── followups/{id}   ├── call_logs/{id}
  ├── voice_notes/{id}    ├── documents/{id}   ├── activities/{id}
  └── products/{id}
```
Composite index: none needed. Pull uses a single-field `updatedAt >` range query per collection.

## 8. Migration policy

`HiveService.schemaVersion` (currently **1**) is stored in `settings`. On open, `MigrationRunner`
applies ordered, idempotent steps (`v1 → v2 …`). Because `fromMap` tolerates missing fields, additive
changes need no migration; renames and type changes get explicit steps.
