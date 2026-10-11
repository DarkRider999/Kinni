# 05 · User Flows

## UF-1 First launch
```
Install → Splash → Onboarding
  1 Photo (camera/gallery, optional) → 2 Name* → 3 Mobile* → 4 Theme
  → 5 PIN (enter + confirm, mismatch = shake + retry) → 6 Fingerprint (offered only if supported)
  → 7 Products (defaults ticked, add custom) [+ optional sample data]
  → 8 Recovery code (copy, confirm "I saved it")
  → vault key generated, boxes created encrypted → Motivation → Home
```

## UF-2 Daily open
```
Tap icon → Splash → Lock
  biometric enabled? → system prompt → success → vault opens
  else PIN / pattern
  wrong ×1–4 → "N attempts remaining"
  wrong ×5  → intruder photo + event logged + lockout 30 s (doubles per round, max 30 min)
→ Motivation dialog (heart closes it) → Home
Inactivity ≥ auto-lock minutes, or background > timeout → Lock (vault closed)
```

## UF-3 Capture a lead (≤ 30 s target)
```
Add Lead tab
  ├ Import contact → picker → choose number(s) → name/phone/avatar prefilled
  ├ Scan card → camera → OCR → review extracted fields → prefilled
  └ Manual
Fill product / status / followup → Save
  duplicate? → Open existing | Merge | Save anyway
→ Timeline "Lead created" · followup reminders scheduled → Profile opens
```

## UF-4 Work the day
```
Home → Today's Tasks / AI Recommendations
  [Call] → dialer → return to app → Outcome sheet
      Interested → status Interested
      Call back  → pick date/time → followup + reminders
      No answer  → auto followup +2 h
      Rejected   → Not Interested
      Wrong no.  → flag + Low priority
  [WhatsApp] → template picker → preview (placeholders filled) → WhatsApp opens → activity logged
  [✓] → followup completed → productivity +1
```

## UF-5 Document collection
```
Profile → Documents → required list (6) + custom
  [Request via WhatsApp] (Document Request template lists the pending docs)
  tap a doc → Camera scan | Gallery | PDF → status Received
  verify → Verified | Rejected (note)
  all required received → suggest status "Documents Received"
```

## UF-6 Application progress
```
Profile → status stepper → Change → choose the next state
  Approved  → ask approved amount
  Disbursed → ask disbursed amount → confetti (Lottie)
  → activity statusChanged(from,to) → dashboard refresh
```

## UF-7 Reminder lifecycle
```
Followup saved for T
  schedule T-24h, T-3h, T-1h, T (skip any already past)
Notification tap → app → (lock if needed) → client profile
T passes, still pending → "Missed followup" notification (once)
Reschedule → cancel 4 ids → schedule new set
Complete → cancel all
```

## UF-8 Reports & export
```
Reports → choose period + group → charts
[Excel] → workbook (6 sheets) → share sheet / save
[PDF]   → KPI summary + tables → share sheet / save
```

## UF-9 Backup / restore / sync
```
Daily 02:00-ish (WorkManager) → backup ZIP → keep 7
Settings → Backup → [Backup now] [Restore] [Export]
Restore → pick ZIP → validate manifest → confirm "replace all data" → import → reschedule reminders
Cloud sync on → anonymous sign-in → push dirty + pull newer → "Last synced 2 min ago"
Network lost → everything continues locally → on reconnect, sync runs automatically
```

## UF-10 Forgot PIN
```
Lock → Forgot PIN → enter recovery code → valid → set new PIN → event recoveryUsed
Invalid recovery code counts as a failed attempt.
```
