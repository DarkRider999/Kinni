# 04 · UI Wireframes

Design language: **glassmorphism on soft personal backgrounds**. Primary `#6C63FF`,
secondary `#FF6B9D`, background `#F8FAFC`, Material 3, 16 dp radius, 12–20 dp spacing.

| Tab | Background image | Overlay |
|---|---|---|
| Home | `bg_gold` (black and gold) | 86% surface gradient |
| Clients | `bg_blush` (white and pink) | 88% |
| Add Lead | `bg_lotus` (lotus water) | 86% |
| Followups | `bg_blush` | 88% |
| Reports | `bg_gold` | 88% |
| Settings | `bg_lotus` | 86% |
Dark mode uses the same images under a 90% `#0F0E17` overlay.

## Splash
```
┌───────────────────────────┐
│                           │
│      ◯  [ANJALI logo]     │  ← scale 0.8→1.0 + glow pulse
│                           │
│      Anjali CRM AI        │  ← fade in
│  Never Miss A Lead Again  │
│                           │
│        ● ○ ○              │  ← progress dots
└───────────────────────────┘
```

## Lock screen
```
┌───────────────────────────┐
│     ◯ logo (small)        │
│   Welcome back, Anjali    │
│     ● ● ○ ○ ○ ○           │  ← PIN dots, shake on error
│  "3 attempts remaining"   │
│   1   2   3               │
│   4   5   6               │
│   7   8   9               │
│  [⊙]  0   ⌫               │  ← ⊙ = fingerprint
│ Use pattern · Forgot PIN? │
└───────────────────────────┘
Lockout: "Too many attempts. Try again in 00:30" (+ intruder photo taken silently)
```

## Motivation dialog (after unlock)
```
┌───────────────────────────┐
│  ✦  ✧    UNIVERSE   ✧  ✦  │  ← themed gradient + icon (✨ / 🌿 / ☀)
│                           │
│  "The universe is not     │
│   working against you…"   │
│                           │
│           ♥               │  ← heart close button (heartbeat animation)
│     tap the heart to begin│
└───────────────────────────┘
```

## Onboarding (7 steps, progress bar on top)
```
[Photo]  ◯ + camera/gallery     →  [Name]  "What should we call you?"
[Mobile] +971 …                 →  [Theme] Light / Dark / System preview cards
[PIN] 6-dot pad + confirm       →  [Fingerprint] toggle + test
[Products] chips ✓ Personal Loan ✓ Business Loan … [+ Add]  [☐ Load sample data]
[Recovery code] ABCD-EFGH-JKLM  [Copy] [I saved it →]
```

## Home
```
┌───────────────────────────┐
│ Good Morning, Anjali  (◯) │
│ Saturday, 11 Oct          │
│ [🔍 Search clients…   🎤] │
│ ┌ Productivity today ───┐ │
│ │ ✓4 ☎7 ★1 ⏳3  W 72 M 64│ │
│ └───────────────────────┘ │
│ KPI grid (2 cols, 13 cards, tap = filtered list)  │
│ [Total 124][New 18][Interested 22][Docs 9]…       │
│ ── AI Recommendations ──  │
│ 🔥 Call Fatima: overdue 2d│
│ 📄 Collect docs: Rahul    │
│ ⭐ Likely to convert: Omar│
│ ── Today's Tasks ──       │
│ 10:00 Ahmed  [☎][WA][✓]   │
│ ── Charts (swipe) ──      │
│ Funnel · Monthly · Product · Approval % · Status pie │
│ ── Recent activity ──     │
└───────────────────────────┘
[Home][Clients][ ＋ ][Followups][Reports][Settings]
```

## Clients list
```
[Search …][Filter ▾][Sort ▾]
Chips: All · New · Interested · Docs · Submitted · Approved …
┌───────────────────────────┐
│ ◯ Fatima Khan    ●Interested│
│   Personal Loan · AED 12k │
│   ⏰ Today 10:00   ★★★★☆ 82│  ← score badge
│   [☎] [WA] [›]            │
└───────────────────────────┘
```

## Add lead / client form
```
Quick fill: [📇 Import contact] [📷 Scan card]
◯ photo
Name* · Phone* · WhatsApp (same as phone ☑) · Email
Company · Job title · Nationality · Monthly salary (AED)
Product ▾ · Lead source ▾ · Status ▾ · Priority (segmented) · Rating ★★★★★
Location [text] [📍 Pick on map]
Followup  [date] [time]
Remarks (multiline)
[🎤 Voice note]  [📎 Documents]   (available after the first save)
[Save lead]
```

## Customer profile
```
◯ Fatima Khan  ●Interested  Score 82
Personal Loan · Emirates NBD · AED 12,000
[☎ Call] [WA] [📍 Map] [✎ Edit]
Status stepper  New ─ Int ─ Docs ─ Sub ─ Rev ─ App ─ Disb   [Change ▾]
Tabs: Timeline | Notes | Documents | Calls | Followups | Files
```

## Followups
```
Segments: [Today 4][Tomorrow 2][Week 9][Upcoming][Overdue 3][Done]
┌───────────────────────────┐
│ 10:00  Fatima Khan        │
│ "Ask for salary cert"     │
│ [☎][WA][↻ Reschedule][✓]  │
└───────────────────────────┘
```

## Reports
```
Period ▾ (This month / Last 3 / Year / All)
KPI row: Approval % · Rejection % · Conversion % · Avg followups
Group by: [Month][Product][Status][Location][Salary][Source] → bar chart + table
Lead source performance table (leads, converted, rate)
[⬇ Excel] [⬇ PDF] → share sheet (WhatsApp · Email · Save to device)
```

## Settings
```
◯ Anjali · +971…  [Edit profile]
Appearance: Theme ▾ (System / Light / Dark)
Security: Fingerprint ◉ · Change PIN · Pattern lock ◉ · Auto-lock 5 min ▾ · Security log
Notifications: Reminder offsets · Daily motivation ◉
Data: Products · Export data · Backup & restore · Cloud sync
Sample data: Load / Clear
About: version, licences
```
