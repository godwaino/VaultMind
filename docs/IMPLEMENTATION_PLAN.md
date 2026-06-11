# VaultMind — MVP Implementation Plan

**Companion to:** `docs/ARCHITECTURE.md` and `VaultMind_PRD_v1.0.docx`
**Timeline:** 16 weeks (PRD §7), solo developer with code-review discipline (risk register)
**Pre-condition:** the PRD's two-week landing-page validation (§11.1) passes its Go/No-Go threshold (40+ waitlist sign-ups AND 15+ willing-to-pay) **before Phase 0 starts**.

---

## Week -2 to 0 — Pre-build validation (PRD §11.1, mandatory)

- [ ] Single-page landing site (can reuse the `backend/` Next.js app on Vercel): value prop for Smart Vault / ExpiryGuard / ContractScan, waitlist form with the three qualifying questions.
- [ ] Drive ~200 targeted visits (LinkedIn, professional WhatsApp groups).
- [ ] **Price the validation at the real price (DECISIONS.md #5):** test willingness-to-pay at **early-access ₦1,500 and/or standard ₦3,500**, not ₦2,000. Treat survey "yes" as a soft signal; weight early-access pre-commitment as the binding one.
- [ ] **Gate:** ≥40 sign-ups and ≥15 willing-to-pay *at the real price* → proceed. Otherwise stop and revisit positioning.

Deliverable that carries forward: the waitlist becomes the Early Access invite pool (§11.2).

---

## Phase 0 — Foundations (Weeks 1–3)

**Exit criteria (PRD):** user can register, verify email, set up MFA, and log in securely.

### Workstreams

1. **Repo & CI/CD**
   - Monorepo scaffold per ARCHITECTURE §3.1 (Expo app, domain packages, Next.js backend, Supabase migrations).
   - GitHub Actions: typecheck, lint, unit tests, Expo EAS build (dev profile), Vercel preview deploys, Supabase migration check.
   - Branch protection + PR review checklist (solo-dev code-review mitigation).
2. **Supabase setup**
   - Project, Auth config, schema migration v1 (`profiles`, `entitlements`, `usage_counters`, `consent_events`, `audit_log`), RLS policies on every table, storage bucket for backups (locked down; unused until Phase 1+).
3. **Authentication (REQ-AUTH-001..005)**
   - Email + password registration with complexity validation; Nigerian phone (E.164 +234) validation.
   - Email verification gate (Resend); blocked dashboard until verified.
   - MFA: TOTP enrolment (QR + manual code); SMS OTP fallback (**decision needed: Termii vs Twilio — Week 1**).
   - Biometric unlock (Face ID / fingerprint) for returning sessions, backed by Keychain/Keystore — local re-auth only.
   - Session policy: 15-min access tokens, refresh rotation, 30-min inactivity logout (NFR-SEC-005).
4. **Encryption layer (`packages/crypto`)**
   - LMK generation + Keychain/Keystore storage; AES-256-GCM file envelope (encrypt/decrypt streams); encrypted SQLite bring-up; Argon2id KDF for the backup KEK (function only — backup itself lands later).
   - **Recovery phrase / recovery kit (MVP, DECISIONS.md #2, ADR-007):** BIP39-style phrase generation + key re-derivation, and the encrypted recovery-kit file format. Build the crypto here in Phase 0; wire the user-facing enable/restore flow alongside backup in Phase 4.
   - Unit-test vectors + a tamper test (GCM auth-tag failure must surface); recovery round-trip test (phrase → re-derived key decrypts a backup blob).
5. **NDPA groundwork** (NDPA 2023 — not the superseded NDPR 2019 the PRD cites; see ARCHITECTURE §8/ADR-009)
   - Privacy notice drafted and published (PRD Phase 0 deliverable).
   - Onboarding flow (≤3 screens, REQ-ONB-001..004): value prop → plain-English privacy summary → granular consent toggles → optional first-upload prompt with empty-state dashboard.
   - `packages/consent` with `ConsentToken` enforcement and `consent_events` writes.

**Phase 0 risks to burn down early:**
- SMS deliverability in Nigeria (test with real numbers week 2); encrypted-SQLite performance on low-end Android.
- **Week-1 device spike (moved up from Phase 3):** benchmark the on-device **SLM** (1B-class candidate, e.g. Llama 3.2 1B Q4; sub-1B fallback) via llama.rn on a representative low/mid-range device (e.g. 3–4GB-RAM Tecno/Infinix) — load time, RAM headroom, 10-page analysis latency *and quality*. The result **fixes the SLM choice** (config value). If even the SLM can't deliver acceptable on-device analysis, ship **cloud-LLM-only ContractScan** for MVP *now*, before the architecture hardens around it (DECISIONS.md #3/#8). This also de-risks the 16-week solo schedule.

---

## Phase 1 — Smart Document Vault (Weeks 4–7)

**Exit criteria (PRD):** upload a document, have it auto-categorised, find it via search.

### Week 4 — ingestion
- Camera capture, gallery picker, file browser (PDF/JPG/PNG/DOCX); validation (≤25MB, ≤50 pages); SHA-256 duplicate warning; compression rendition; encrypted persistence; resumable job queue.
- Upload progress UI for files >2MB (REQ-VAULT-004).

### Week 5 — OCR
- Tesseract integration with preprocessing (deskew/binarise); confidence scoring; <70% → manual-review flag (REQ-VAULT-009).
- Cloud fallback path: consent prompt → `/api/ocr/fallback` (Google Vision proxy, ephemeral) → result merge (REQ-VAULT-006).
- Benchmark: single-page photo ≤10s on 2022 mid-range Android (NFR-PERF-002). If Tesseract misses, tune preprocessing before considering heavier options.

### Week 6 — AI metadata & categorisation
- Llama 3.2 1B via llama.rn, first-run Wi-Fi model download (ADR-003); GBNF-constrained JSON extraction: doc type, issuer, key dates, identifiers (REQ-VAULT-007).
- Metadata review/correction screen before save (REQ-VAULT-008).
- Six-category auto-assignment + one-tap override + sub-category tags (REQ-VAULT-010..013). Build a 100-doc labelled eval set from Nigerian document samples (passport, NIN slip, tenancy agreement, NEPA bill, …) — categorisation accuracy is a launch-quality gate.

### Week 7 — search, management, limits
- FTS5 index + query rewrite + ranking + filters (REQ-VAULT-014..017); perf fixture: 200 docs <2s.
- Rename, notes, sort options; delete with 7-day undo grace + crypto-shredding purge (REQ-VAULT-018..021).
- Free-tier 50-doc cap with upgrade prompt (REQ-VAULT-022).
- Document dashboard UI polish; 3-taps-to-anything audit (NFR-UX-001).

*(Cloud backup — REQ-VAULT-023..027 — implement the client+server flow in Phase 4 alongside Paystack. Note the tier change (DECISIONS.md #1, ADR-010): backup is **available on the free tier too, opt-in, capped at 5 GB**; paid tiers raise the cap. Entitlements gate the cap, not access.)*

---

## Phase 2 — ExpiryGuard (Weeks 8–10)

**Exit criteria (PRD):** push notification 30 days before a tracked document expires.

### Week 8 — extraction & tracking
- Expiry-date detection wired into the ingestion pipeline for the supported doc types (REQ-EXPIRY-002, **minus NIN and Voter's Card — neither expires**; they stay as vault categories only); confidence threshold → manual entry required (REQ-EXPIRY-003); edit/override UI (REQ-EXPIRY-004).
- Free-tier cap: 5 tracked documents (monetisation table).

### Week 9 — reminder engine
- **Per-doc-type reminder policies with effective expiry** (ARCHITECTURE §4.3, ADR-008): passports remind from 6 months *before the 6-month-validity cutoff* (i.e. 12 months before printed expiry); flat T-90/30/7/0 remains the default for unknown/manual types (REQ-EXPIRY-005 as floor). Policy table ships as versioned remote JSON alongside renewal guidance.
- Local scheduling via Expo Notifications; personalised copy naming the *effective* deadline (REQ-EXPIRY-007); dismiss-one-keep-rest semantics (REQ-EXPIRY-008); reschedule on edit; fully offline (REQ-EXPIRY-009).
- **Travel-readiness check:** "I'm travelling on ⟨date⟩" → evaluate passport effective validity, visas, and other travel docs against the trip date; flag failures immediately. Client-side only, ~1–2 days of work on top of the policy engine, and it's the strongest demo moment in the product (catches the "passport expires in 2 months, trip is next week" scenario a year early).
- Opt-in email secondary channel: minimal `(label, fire_at)` registration + Vercel cron + Resend template (ARCHITECTURE §4.3 trade-off).
- Time-travel test harness (fake clock) for the schedule matrix.
- **Validation-mode early reminders (DECISIONS.md #4):** a beta/validation flag that fires an early or synthetic reminder shortly after a tracked document is added, so testers actually experience an alert instead of waiting ~89 days. Instrument **"documents under management"** and **"reminders that fired and were acted on"** as the primary value signals; treat raw retention as secondary context.

### Week 10 — dashboard
- ExpiryGuard screen: urgency colours (green/amber/red/grey), sorting, expired-doc "Renew / Update" persistence until replaced (REQ-EXPIRY-010..013).
- Renewal-guidance content JSON for all 11 doc types (plain English + authority + link, e.g. NIMC/NIS) — content writing task, start week 8 in parallel (REQ-EXPIRY-014).

---

## Phase 3 — ContractScan Lite (Weeks 11–14)

**Exit criteria (PRD):** upload a tenancy agreement, receive plain-English breakdown with red flags.

### Week 11 — upload flow + Tier 1 spike
- Dedicated ContractScan upload UI (separate from vault flow) with the "what this does" explainer (REQ-CONTRACT-001..003).
- **Tier-1 go/no-go (informed by the week-1 device spike):** confirm the on-device **SLM** gate and page ceiling on current builds (NFR-PERF-004); if the week-1 spike already failed, this week becomes cloud-LLM (Tier-2) polish instead.
- Shared result schema + encrypted result persistence to vault (REQ-CONTRACT-010).

### Week 12 — Tier 1 local analysis
- Chunked map-reduce pipeline, GBNF-constrained output, verdict escalation rules; "less detailed" notice when local-only was chosen.
- Build the **contract eval set**: ≥20 real Nigerian contracts (tenancy, employment offer, loan) with expert-annotated red flags — this is the quality bar for both tiers.

### Week 13 — Tier 2 Claude integration
- `/api/contractscan/analyze` per ARCHITECTURE §6.3: consent-token check, entitlement + 2/month counter (REQ-CONTRACT-012..014), in-memory handling, `@anthropic-ai/sdk` with `claude-sonnet-4-6` (config-driven), prompt-cached system prompt, PDF/image document blocks, structured outputs against the shared schema, SSE streaming to the app, typed error mapping (429/529/refusal/max_tokens).
- Non-dismissable consent gate with exact PRD copy + "Analyse Locally Only" branch (REQ-CONTRACT-005).
- **Compliance task (blocking exit):** Anthropic retention/ZDR arrangement or consent-copy alignment (ARCHITECTURE §6.3).
- Run both tiers against the eval set; if Sonnet red-flag recall disappoints, A/B `claude-opus-4-8` via config.

### Week 14 — results UX + hardening
- Structured scrollable results screen; clause-text-beside-explanation rendering (REQ-CONTRACT-007/008); prominent non-dismissable disclaimer on every result (REQ-CONTRACT-009); re-run action (REQ-CONTRACT-011); free-tier usage counter display (REQ-CONTRACT-014).
- Latency validation: Tier 2 ≤60s with progress (NFR-PERF-005).

---

## Phase 4 — Launch (Weeks 15–16)

**Exit criteria (PRD):** store approvals, payment flow E2E, 20 internal beta users onboarded.

- **Paystack** (week 15): plans (Personal ₦3,500 / early-access ₦1,500 lock; **sell Personal only; waitlist Family** — don't build entitlements for an unbuilt feature, DECISIONS.md nit B), init/verify, webhook → entitlements, offline entitlement claim, upgrade/cancel flows; E2E test with real cards/bank transfer/USSD.
- **Cloud backup** (free-tier opt-in ≤5 GB, paid raises the cap — DECISIONS.md #1): consent screen per REQ-VAULT-024, client-side encrypt → signed-URL upload, manifest versioning, restore flow, disable + remote-wipe (REQ-VAULT-023..027). Wire the **recovery-phrase / recovery-kit** enable + restore flow (crypto built Phase 0); surface the recovery setup at backup enablement and the "no recovery saved = no recovery possible" warning.
- **Data export & erasure:** local export (PDF/JSON), server export endpoint, one-tap account deletion with 24h/72h purge jobs (NFR-SEC-007/008).
- **Penetration test:** external vendor, scope per ARCHITECTURE §5; remediate critical/high before submission (NFR-SEC-010). Book the vendor in **week 11** — lead times are long.
- **Store submissions:** iOS build submitted **start of week 15** (2-week buffer per risk register); encryption export compliance (standard-encryption exemption docs); Play Store data-safety form aligned with the privacy notice; ASO copy (keywords: "document organiser Nigeria", "contract reader app").
- **QA:** E2E device matrix (iPhone 12+, Android 5.5"–6.7", incl. one low-storage low-RAM device); offline-mode suite; accessibility pass to WCAG 2.1 AA targets + dynamic type (NFR-UX-004); crash-rate soak via internal beta (<0.5%).
- **Beta:** 20 internal users from the waitlist; instrument the activation funnel (register → first upload → first search → first reminder set → first scan).

---

## Cross-cutting tracks (run every phase)

| Track | Cadence |
|---|---|
| Documentation (ADRs, runbooks, this plan) | Per merge — solo-dev continuity mitigation |
| Eval sets (categorisation docs, contracts) | Grow weekly from Phase 1; quality gates at Phase 1/3 exits |
| Metrics instrumentation (PRD §9 targets) | Land events with each feature, not retroactively |
| Security review checklist | Each PR touching crypto/consent/egress paths |
| Cost watch (Claude, Vision, SMS) | Weekly from Phase 3; per-analysis unit cost dashboard |

## Success-metric instrumentation map (PRD §9)

| Metric | Source |
|---|---|
| Registered users (500+) | Supabase `profiles` |
| Documents uploaded (2,000+) | Opt-in analytics event `doc_uploaded` (count only) |
| Paying subscribers (50+) / MRR (₦175k+) | `entitlements` + Paystack dashboard |
| ContractScan analyses (200+) | `usage_counters` (Tier 2) + opt-in event (Tier 1) |
| ExpiryGuard tracked (300+) | Opt-in event `expiry_tracked` |
| D30 retention (40%+) | Opt-in analytics cohort |
| Store rating 4.2+ / NPS 40+ | Store consoles / in-app survey (post-3rd-session) |
| Critical security incidents (0) | `audit_log` + Sentry alerts |

Note: several metrics depend on **opt-in** analytics (NDPA posture). Expect undercounting; treat analytics-derived numbers as floors and say so in the validation review.

Note (DECISIONS.md #4): document management is inherently low-frequency, so **raw D30 retention understates value**. Judge the product primarily on **documents under management** and **reminders that fired and were acted on**; keep D30 retention as secondary context, not a pass/fail gate.
