# Phase 2 — ExpiryGuard: Status

**Branch:** `claude/phase-0-foundations` (continues from Phases 0–1)
**Plan reference:** `docs/IMPLEMENTATION_PLAN.md` → Phase 2 (Weeks 8–10).
**Exit criteria (PRD):** push notification 30 days before a tracked document expires.

Same pattern as before: domain logic **built and tested**; OS notifications, the email cron, and the dashboard UI are **injected via ports / left as UI work**, per your "interfaces + stubs + notes" choice.

## What runs and is tested now (Node/TypeScript)

| Capability | Where | Maps to |
|---|---|---|
| Calendar-accurate date math (month subtraction with end-of-month clamping) | `expiry-core/dates.ts` | ADR-008 |
| Tracked doc types — **NIN and PVC excluded** (they don't expire) | `expiry-core/docTypes.ts` | DECISIONS nit A, REQ-EXPIRY-002 |
| Per-type reminder policies with **effective expiry** (passport = printed − 6 months) | `expiry-core/policies.ts` | ADR-008, REQ-EXPIRY-005 |
| Reminder builder; copy names the **effective deadline**, not the printed date | `expiry-core/reminders.ts` | REQ-EXPIRY-007 |
| Tracking: create, confidence-gated manual confirmation, free-tier 5-doc cap | `expiry-core/tracking.ts` | REQ-EXPIRY-002/003, monetisation |
| Local-notification scheduling (offline), reschedule on edit | `expiry-core/tracking.ts` + ports | REQ-EXPIRY-004/009, ADR-002 |
| Dismiss-one-keep-the-rest | `expiry-core/tracking.ts` | REQ-EXPIRY-008 |
| Expired → persistent "replaced/renewed" handling | `expiry-core/tracking.ts` | REQ-EXPIRY-013 |
| **Validation-mode early reminder** (synthetic, so testers see an alert) | `expiry-core/reminders.ts` | DECISIONS #4 |
| Opt-in email channel — registers label + fire date only (no content) | `expiry-core/tracking.ts` + ports | ARCHITECTURE §4.3 |
| Urgency bands green/amber/red/grey (vs effective expiry) | `expiry-core/urgency.ts` | REQ-EXPIRY-011 |
| **Travel-readiness check** ("travelling on <date>") | `expiry-core/travel.ts` | ARCHITECTURE §4.3 |
| Renewal guidance content (NIS, FRSC, NAICOM, …) for every type | `expiry-core/guidance.ts` | REQ-EXPIRY-014 |

**Test counts:** 89 total across the monorepo; ExpiryGuard adds 18 (date math, policies, tracking lifecycle, urgency, travel-readiness, guidance).

```bash
npm test          # 89 tests; NODE_OPTIONS=--experimental-sqlite set by the script
npm run typecheck
```

### The two design pieces worth re-reading
- **Effective expiry (ADR-008).** A passport's reminders are computed against `printed − 6 months`, so its earliest reminder fires a full **12 months** before the printed date and the copy says "must be renewed by <effective date>". A test asserts exactly this. The flat 90/30/7/0 schedule remains the default for `other`/manual types (REQ-EXPIRY-005 floor).
- **Travel-readiness.** `travelReadiness(tracked, tripDate)` evaluates passports on effective validity and visas on their printed date, returning blockers/warnings. The headline test is the "passport fails the 6-month rule for an upcoming trip" scenario the feature exists to catch.

## Interfaces + stubs (need device / live services)

- **Local notifications** (`NotificationScheduler`) — device adapter wraps **Expo Notifications**; the in-memory adapter records and skips past-dated fires. The PRD exit criterion (a real push 30 days out) is met logically here and needs the Expo adapter on a device to be literally observable.
- **Email channel** (`EmailReminderRegistry`) — device/server adapter = a Vercel cron sweeping due `(label, fireAt)` rows + Resend. Default off.
- **Tracking repo** — in-memory here; device = encrypted `expo-sqlite`.
- **Expiry extraction** — the date itself comes from the Phase-1 SLM `MetadataExtractor` (`metadata.expiryDate`) plus `inferExpiryDocType(...)`; below the confidence threshold ExpiryGuard returns `needs_manual_confirmation` and the UI asks the user to confirm.
- **Dashboard UI** — the urgency screen (colour bands, sorting, the expired "Renew/Update" card) and the "I'm travelling on…" entry point are Expo work.

## Phase 2 exit checklist (PRD)

- [x] Expiry tracking wired to extraction + manual confirmation; NIN/PVC excluded
- [x] Effective-expiry reminder policies (incl. the passport 6-month rule)
- [x] Reminder scheduling, reschedule-on-edit, dismiss-one semantics (logic; OS scheduler mocked)
- [x] Travel-readiness check
- [x] Urgency bands + renewal guidance content
- [x] Free-tier 5-doc cap; opt-in email registration (minimal data)
- [x] Validation-mode early reminders (DECISIONS #4)
- [ ] Expo Notifications adapter delivering a real device push (observable 30-day reminder)
- [ ] `expo-sqlite` tracking repo in place of the in-memory one
- [ ] ExpiryGuard dashboard UI + travel-readiness entry point
- [ ] Time-travel QA pass on a device across the full schedule matrix

The logic for "a reminder fires 30 days before expiry" is complete and tested; making it a literal device push is the Expo-adapter step. Everything checkable in a pure Node/TS sandbox is done and green.
