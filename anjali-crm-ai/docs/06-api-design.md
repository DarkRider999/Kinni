# 06 · API Design

The app has no custom backend. "API" here means (1) the internal Dart contracts between layers
and (2) the Firebase surface, including its security rules.

## 1. Repository contracts (domain → data)

```dart
abstract interface class Repository<T extends SyncEntity> {
  Stream<List<T>> watchAll();               // emits on any box change, excludes deleted
  List<T> getAll({bool includeDeleted = false});
  T? getById(String id);
  Future<void> upsert(T entity);            // stamps updatedAt, marks dirty
  Future<void> softDelete(String id);
  Future<void> putRaw(Map<String, dynamic> map);   // sync/restore path (keeps updatedAt, dirty=false)
  List<T> dirty();
  Future<void> markClean(Iterable<String> ids);
}

ClientRepository     : Repository<Client>     + findByPhoneKey, findByEmailKey, search(query)
FollowupRepository   : Repository<Followup>   + forClient(id), pending()
CallLogRepository    : Repository<CallLog>    + forClient(id), between(from, to)
VoiceNoteRepository  : Repository<VoiceNote> + forClient(id)
DocumentRepository   : Repository<ClientDocument> + forClient(id), ensureRequired(clientId)
ActivityRepository   : Repository<Activity>   + forClient(id), recent(limit)
ProductRepository    : Repository<Product>    + active()
TemplateRepository   : Repository<WhatsAppTemplate>
SettingsStore        : get/set typed keys (local only)
SecurityLogRepository: add(event), all()               (local only)
```

## 2. Domain services (pure functions)

| Service | Signature |
|---|---|
| `LeadScoring.score` | `int score(Client c, {required List<Followup> followups, required List<ClientDocument> docs, DateTime? now})` |
| `InsightsEngine.build` | `Insights build({clients, followups, docs, products, now})` returns highPriority, longestWaiting, overdue, bestProduct, bestSource, upcoming |
| `ReportEngine` | `KpiSummary kpis(...)`, `List<GroupRow> groupBy(ReportGroup g, ...)`, `List<FunnelStage> funnel(...)`, `List<MonthPoint> monthly(...)` |
| `DuplicateDetector.find` | `DuplicateMatch? find(Client candidate, List<Client> existing)` |
| `DuplicateDetector.merge` | `Client merge(Client primary, Client other)` (keeps non-empty primary fields, fills gaps) |
| `TemplateRenderer.render` | `String render(String body, Map<String,String> vars)` |
| `FollowupBucketer.bucket` | `Map<FollowupBucket, List<Followup>> bucket(List<Followup>, DateTime now)` |
| `ProductivityCalculator` | `Productivity compute({followups, calls, clients, docs, now})` |
| `MotivationPicker.pick` | `int pick({required int total, required List<int> history, required Random rng, int window = 30})` |
| `BusinessCardParser.parse` | `ParsedCard parse(String ocrText)` |
| `StatusAutomation.forOutcome` | `OutcomeEffect forOutcome(CallOutcome o, DateTime now)` |
| `PhoneUtils.key` | `String key(String raw)` |

## 3. Platform service contracts

```dart
NotificationService: init(), requestPermissions(), scheduleFollowup(Followup f, Client c, List<int> offsets),
                     cancelFollowup(Followup f), showMissed(Followup f, Client c), rescheduleAll(...)
LauncherService    : call(phone), whatsapp(phone, text), navigate(lat, lng), openMap(query), email(to, subject)
AuthService        : hasPin, setPin, verifyPin, setPattern, verifyPattern, verifyRecovery, biometricAvailable, authenticateBiometric
VaultKeyManager    : Future<List<int>> loadOrCreateKey()
SyncService        : bool get isConfigured; Future<SyncReport> syncNow(); void requestSync()
BackupService      : Future<File> createBackup({bool automatic}); Future<void> restore(File zip); List<File> listBackups()
ExcelExporter      : Future<File> export(ExportBundle data)
PdfExporter        : Future<File> exportReport(ReportBundle data); Future<File> exportClient(ClientBundle data)
```

## 4. Firebase surface

### 4.1 Configuration
`config/firebase.json` (git-ignored), passed with `--dart-define-from-file=config/firebase.json`:
```json
{
  "FIREBASE_API_KEY": "…", "FIREBASE_APP_ID": "1:…:android:…",
  "FIREBASE_MESSAGING_SENDER_ID": "…", "FIREBASE_PROJECT_ID": "…",
  "FIREBASE_STORAGE_BUCKET": "….appspot.com"
}
```
Empty values mean offline-only mode.

### 4.2 Firestore documents
`users/{uid}/{collection}/{id}`: the entity `toMap()` minus `dirty`, plus `updatedAt` as an ISO string
(lexicographically sortable) for the `>` pull query.

| Operation | Call |
|---|---|
| Push | `doc.set(map, SetOptions(merge: true))` in batches of ≤ 400 |
| Pull | `collection.where('updatedAt', isGreaterThan: lastPulledAt).get()` |
| File upload | `storage.ref('users/$uid/files/$clientId/$name').putFile(file)` |
| File download (restore) | `ref.writeToFile(localFile)` |

### 4.3 Security rules (`firebase/firestore.rules`, `firebase/storage.rules`)
Only the owner uid may read or write; documents ≤ 1 MB; files ≤ 20 MB with allowed MIME types.

## 5. Intents and deep links used

| Action | URI |
|---|---|
| Call | `tel:+971501234567` |
| WhatsApp | `https://wa.me/971501234567?text=<urlencoded>` |
| Navigate | `google.navigation:q=25.2048,55.2708` (fallback `https://www.google.com/maps/dir/?api=1&destination=lat,lng`) |
| Email | `mailto:x@y.com?subject=…` |
| Notification payload | `followup:<followupId>` → opens the client profile |
