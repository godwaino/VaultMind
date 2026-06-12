# Phase 4 — Launch: Status

**Branch:** `claude/phase-0-foundations` (continues from Phases 0–3)
**Plan reference:** `docs/IMPLEMENTATION_PLAN.md` → Phase 4 (Weeks 15–16).
**Exit criteria (PRD):** store approvals, payment flow E2E, 20 internal beta users onboarded.

Final phase. As before, the **logic is built and tested**; payments UI, store submission, the on-device backup wiring, and the pen test are the device/operational steps.

## What runs and is tested now (Node/TypeScript)

| Capability | Where | Maps to |
|---|---|---|
| Paystack webhook signature verify (HMAC-SHA512, timing-safe) | `backend/lib/billing/paystack.ts` | §7 |
| Event → entitlement mapping; early-access 12-month lock | `backend/lib/billing/paystack.ts` | §7, monetisation |
| Offline signed entitlement claim (short-TTL HMAC) for offline tier checks | `backend/lib/billing/claim.ts` | §7 |
| Client-side encrypted backup: build, upload, restore, manifest | `backup-core` | REQ-VAULT-023..026, DECISIONS #1 |
| Free-tier 5 GB backup cap | `backup-core` | DECISIONS #1 |
| Remote wipe (delete all backup objects) | `backup-core` | REQ-VAULT-027 |
| Account data export (server-held only, explains device data) | `backend/lib/account/account.ts` | NFR-SEC-008 |
| Erasure: mark deleted + 24h-rows / 72h-blobs purge deadlines | `backend/lib/account/account.ts` | NFR-SEC-007 |

**Test counts:** 122 total across the monorepo; Phase 4 adds 15 (billing 7, backup 5, account 3).

```bash
npm test          # 122 tests
npm run typecheck
```

### Design points
- **Backup is zero-knowledge and free-tier (DECISIONS #1).** Each item is encrypted under the Backup Master Key from the Phase-0 keyset; a test confirms stored blobs contain no plaintext and that the wrong key can't restore. The BMK is unlocked by password **or** the recovery phrase (Phase 0), so "forgot password" no longer means "lost backup."
- **Entitlements: webhook is truth, claim is convenience.** The Paystack webhook (signature-verified) writes the tier; the short-TTL signed claim lets the app enforce caps/quota offline between refreshes. Server-side features (Tier-2, backup upload) are still enforced server-side.
- **Erasure deadlines are explicit.** `requestErasure` marks the profile deleted and schedules the rows (≤24h) and blobs (≤72h) purges, with a content-free audit — a test pins the exact deadlines and call order.

## Interfaces + stubs / operational (need device or live services)

- **Paystack adapters** — `backend/app/api/billing/webhook/route.ts` is the real route shell (reads the raw body before parsing so the HMAC matches); the `EntitlementWriter` is a Supabase placeholder. Checkout init/verify + the in-app browser flow are UI work.
- **Backup transport** — `BackupTransport` adapter = Supabase Storage signed URLs; in-memory transport used in tests.
- **Erasure ports** — Supabase row updates + a scheduled purge job (Vercel cron); in-memory fakes in tests.
- **Store submission** — iOS build submitted start of week 15 (2-week buffer), encryption export-compliance docs, Play Store data-safety form aligned to the privacy notice, ASO copy.
- **Penetration test** — scope in `docs/PENTEST_SCOPE.md`; book the vendor in week 11.
- **Beta** — 20 internal users from the waitlist; activation funnel instrumentation.

## Phase 4 exit checklist (PRD)

- [x] Paystack webhook verification + entitlement mapping + early-access lock (logic)
- [x] Offline entitlement claim (logic)
- [x] Cloud backup build/restore/manifest + 5 GB free cap + remote wipe (logic)
- [x] Data export + erasure with purge deadlines (logic)
- [x] Pen-test scope documented
- [ ] Paystack checkout E2E with real cards / bank transfer / USSD
- [ ] Backup wired to Supabase Storage + the recovery UI on device
- [ ] Penetration test passed (no open Critical/High)
- [ ] iOS + Play Store approvals; data-safety/export-compliance forms
- [ ] 20 internal beta users onboarded; activation funnel instrumented

The launch *logic* is complete and tested; the remaining items are live-service wiring, the app UI, the security audit, and store operations — none of which can run in a pure Node/TS sandbox.
