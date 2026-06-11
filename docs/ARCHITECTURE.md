# VaultMind — System Architecture

**Companion to:** `VaultMind_PRD_v1.0.docx` (MVP scope: Smart Document Vault · ExpiryGuard · ContractScan Lite)
**Status:** Draft for review
**Audience:** Engineering (solo developer + future Phase 3 hire), security reviewer, pen-test vendor

---

## 1. Architecture Principles

Everything below follows from four non-negotiable constraints in the PRD:

1. **Local-first.** Documents, OCR text, search index, categories, and expiry data live on the device. The backend is an *auxiliary* service (auth, opt-in encrypted backup, email, payments, Tier-2 AI proxy). Core features (vault browsing, viewing, search, ExpiryGuard dashboard, reminders) must work fully offline (NFR-PERF-006, REQ-EXPIRY-009).
2. **Zero-knowledge for anything that leaves the device.** Cloud backup blobs are encrypted client-side with a key derived from the user's password; the server never holds a decryption key (NFR-SEC-003, REQ-VAULT-025).
3. **Consent gates before data egress.** Cloud OCR fallback, cloud backup, and Tier-2 ContractScan each have an explicit, granular consent step (REQ-ONB-002, REQ-VAULT-023, REQ-CONTRACT-005). The architecture enforces this in code, not just UI: the network layer refuses document-content uploads unless the matching consent flag is set.
4. **Modular by module.** Vault, ExpiryGuard, and ContractScan are separate feature packages with narrow interfaces, mitigating the single-developer risk in the PRD risk register and keeping Phase-2 enterprise work additive.

---

## 2. High-Level System Diagram

```
┌─────────────────────────── DEVICE (trust boundary A) ───────────────────────────┐
│                                                                                  │
│  React Native + Expo app                                                         │
│  ┌────────────┐ ┌─────────────┐ ┌────────────────┐ ┌──────────────────────────┐ │
│  │ Vault UI   │ │ ExpiryGuard │ │ ContractScan UI│ │ Onboarding / Settings /  │ │
│  │            │ │ UI          │ │                │ │ Consent Centre           │ │
│  └─────┬──────┘ └──────┬──────┘ └───────┬────────┘ └────────────┬─────────────┘ │
│        │               │                │                       │               │
│  ┌─────┴───────────────┴────────────────┴───────────────────────┴────────────┐  │
│  │                      Domain layer (TypeScript packages)                   │  │
│  │  vault-core · expiry-core · contractscan-core · consent · crypto · search │  │
│  └─────┬──────────────┬──────────────┬──────────────────┬────────────────────┘  │
│        │              │              │                  │                       │
│  ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴──────┐  ┌────────┴────────────────────┐  │
│  │ Encrypted │  │ SQLite +  │  │ On-device  │  │ Local notification          │  │
│  │ file store│  │ FTS5 index│  │ AI runtime │  │ scheduler (Expo)            │  │
│  │ (AES-256) │  │ (metadata)│  │ Tesseract  │  └─────────────────────────────┘  │
│  └───────────┘  └───────────┘  │ Llama 1B/3B│                                   │
│                                │ (llama.rn) │                                   │
│                                └────────────┘                                   │
└───────────────┬───────────────────────────────────────────┬─────────────────────┘
        TLS 1.3 only                                 TLS 1.3 only
                │                                           │
┌───────────────┴────────────────── BACKEND (trust boundary B) ────────────────────┐
│  Vercel — Next.js API routes (stateless)                                          │
│  /api/auth/* · /api/backup/* · /api/contractscan/analyze · /api/ocr/fallback      │
│  /api/billing/* (Paystack) · /api/notify/* (Resend) · /api/account/delete|export  │
│         │                │                  │                    │                │
│  ┌──────┴──────┐  ┌──────┴───────┐  ┌───────┴────────┐  ┌────────┴────────┐       │
│  │ Supabase    │  │ Supabase     │  │ Anthropic      │  │ Google Vision   │       │
│  │ Auth + PG   │  │ Storage      │  │ Claude API     │  │ API (OCR        │       │
│  │ (RLS)       │  │ (encrypted   │  │ (Tier-2,       │  │ fallback,       │       │
│  │             │  │  backup blobs)│ │  ephemeral)    │  │  ephemeral)     │       │
│  └─────────────┘  └──────────────┘  └────────────────┘  └─────────────────┘       │
│                       Resend (email) · Paystack (payments) · Expo Push            │
└───────────────────────────────────────────────────────────────────────────────────┘
```

**Key boundary rule:** document *content* crosses A→B only in three flows, each consent-gated and ephemeral on the server: (1) cloud OCR fallback, (2) Tier-2 ContractScan, (3) encrypted backup (content crosses, but only as ciphertext the server cannot read).

---

## 3. Mobile App Architecture

### 3.1 Stack & project layout

- **React Native + Expo** (PRD §6), TypeScript throughout, Expo Router for navigation.
- Monorepo layout so domain logic is testable without the RN runtime:

```
apps/mobile/             # Expo app (screens, navigation, theming)
packages/vault-core/     # upload pipeline, OCR orchestration, categorisation, doc CRUD
packages/expiry-core/    # expiry extraction, reminder scheduling rules, urgency logic
packages/contractscan-core/  # tier routing, local analysis, Tier-2 client, result model
packages/crypto/         # key derivation, AES-256-GCM envelope, secure storage wrappers
packages/consent/        # consent registry, gate enforcement, NDPR audit log
packages/search/         # FTS5 query building, ranking, filters
packages/api-client/     # typed client for backend routes; refuses egress w/o consent
backend/                 # Next.js API routes (deployed to Vercel)
supabase/                # migrations, RLS policies, storage policies
docs/                    # this document, plans, ADRs
```

### 3.2 Local storage design

| Store | Technology | Contents | Encryption |
|---|---|---|---|
| Document files | App-sandbox filesystem (`expo-file-system`) | Original files + compressed renditions, ≤25MB, ≤50 pages | AES-256-GCM per file, random DEK per file |
| Metadata DB | SQLite (`expo-sqlite`) | documents, categories, tags, expiry dates, reminders, analysis results | SQLCipher-style full-DB encryption; DB key in `react-native-encrypted-storage` (Keychain/Keystore-backed) |
| Search index | SQLite FTS5 virtual table | OCR text, titles, notes | Same encrypted DB |
| Key material | `react-native-encrypted-storage` + OS Keychain/Keystore | local master key (LMK), session tokens | Hardware-backed where available |

**Key hierarchy:**

```
User password ──PBKDF2/Argon2id──► KEK (backup key, derived on device, never stored, never sent)
Device random ───────────────────► LMK (local master key, in Keychain/Keystore)
LMK ──wraps──► per-file DEKs and SQLite DB key
KEK ──wraps──► backup envelope key (only when cloud backup enabled)
```

- Local at-rest encryption is independent of the password (so biometric unlock works offline without re-deriving the KEK).
- Backup encryption uses the password-derived KEK → server is zero-knowledge (NFR-SEC-003). **Consequence to surface in UX:** a forgotten password makes cloud backups unrecoverable; the recovery flow resets the account, not the data. The PRD's zero-knowledge requirement makes this unavoidable — call it out on the backup consent screen (REQ-VAULT-024).
- Deletion: 7-day grace (REQ-VAULT-020) = soft-delete flag + scheduled purge job in the app; purge destroys the DEK first (crypto-shredding), then the file.

### 3.3 Document ingestion pipeline (Vault)

```
capture/pick file (REQ-VAULT-001)
  → validate (type, ≤25MB, ≤50 pages) → duplicate check (SHA-256 content hash, REQ-VAULT-005)
  → compress rendition (risk-register mitigation for low-storage devices)
  → encrypt + persist
  → OCR job (background queue):
       Tesseract on-device (REQ-VAULT-006)
       ├─ confidence ≥ 70% → continue
       └─ confidence < 70% → flag for manual review (REQ-VAULT-009)
            └─ offer cloud fallback (Google Vision) — explicit user notification + consent
  → metadata extraction (Llama 3.2 1B via llama.rn): doc type, issuer, dates, identifiers (REQ-VAULT-007)
  → user review/correction screen (REQ-VAULT-008)
  → auto-categorisation (1B model, fully on-device, REQ-VAULT-010/011) → user can override (REQ-VAULT-012)
  → index into FTS5 → ExpiryGuard hook: if expiry date found, register tracking + schedule reminders
```

The pipeline is a resumable job queue (persisted in SQLite) so an app kill mid-OCR doesn't lose work, and the ≤10s single-page target (NFR-PERF-002) is met by running OCR off the JS thread (native module) with the progress indicator driven by job-state events.

### 3.4 Search

- Plain-English search (REQ-VAULT-014) = FTS5 `MATCH` over OCR text + title + notes + tags, with a light query-rewrite layer (synonym/stem expansion, year extraction so "my 2023 rent agreement" boosts docs dated 2023 and category=Property).
- Ranking: BM25 from FTS5, boosted by category match, recency, and exact phrase hits. No embedding model in MVP — FTS5 comfortably meets the <2s @ 200 docs target (NFR-PERF-003) and keeps everything offline (REQ-VAULT-015). An on-device embedding upgrade is a clean Phase-2 swap behind the `search` package interface.
- Filters (category, date range, doc type) compile to SQL `WHERE` clauses (REQ-VAULT-017).

### 3.5 On-device AI runtime

| Task | Model | Runtime | Notes |
|---|---|---|---|
| OCR | Tesseract | `react-native-tesseract-ocr` | eng traineddata bundled; preprocessing (deskew, binarise) before OCR materially lifts accuracy on phone photos |
| Classification + metadata extraction | Llama 3.2 1B (Q4) | `llama.rn` | Constrained generation (GBNF grammar) to force JSON output for the 6 categories + fields |
| ContractScan Tier 1 | Llama 3.2 3B (Q4) | `llama.rn` | Chunked map-reduce over ≤10 pages; ~2GB RAM budget — gate Tier 1 by device RAM, low-end devices route to Tier 2 (with consent) or "summary-only" local mode |

Models ship in the app bundle (or first-run download over Wi-Fi to keep store binary small — decision ADR-003). Model updates ride app releases (per risk register).

---

## 4. Backend Architecture

### 4.1 Services (Next.js API routes on Vercel)

All routes are stateless; Supabase is the only state. Every route enforces: TLS 1.3 (reject below — NFR-SEC-002, via Vercel config + HSTS), Supabase JWT verification, rate limiting (Upstash/Vercel KV), and structured audit logging *without document content*.

| Route group | Responsibility |
|---|---|
| `/api/auth/*` | Registration glue (email + Nigerian phone validation), MFA enrolment (TOTP secret provisioning / SMS OTP via provider), session policy (30-min inactivity — NFR-SEC-005, enforced via short-lived JWTs + refresh rotation) |
| `/api/backup/*` | Signed-URL issuance for encrypted blob upload/download to Supabase Storage; manifest versioning; remote-wipe endpoint (REQ-VAULT-026) |
| `/api/contractscan/analyze` | Tier-2 proxy to Claude API (see §6). Holds the Anthropic key; the key never ships in the app |
| `/api/ocr/fallback` | Proxy to Google Vision; processes and returns text; stores nothing |
| `/api/billing/*` | Paystack init/verify/webhook; entitlement writes |
| `/api/notify/email` | Resend transactional email (verification, expiry reminders as secondary channel) |
| `/api/account/export` | Assembles JSON/PDF export of server-held data (NFR-SEC-008); device-side data exports locally |
| `/api/account/delete` | One-tap erasure: purge rows ≤24h, storage blobs ≤72h via scheduled job (NFR-SEC-007) |

### 4.2 Supabase data model (server holds *metadata and ciphertext only*)

```sql
-- All tables RLS: user_id = auth.uid()

profiles(user_id PK, email, phone_e164, mfa_method, ndpr_consents jsonb,
         created_at, deleted_at)

entitlements(user_id PK, tier text CHECK (tier IN ('free','personal','family')),
             paystack_customer_id, paystack_sub_id, current_period_end,
             early_access_lock_until)

usage_counters(user_id, metric text, period date, count int)
  -- 'contractscan_analyses' for free-tier 2/month (REQ-CONTRACT-012);
  -- 'documents' & 'expiry_tracked' counters are device-authoritative but
  -- mirrored here on backup for cross-install enforcement of the 50-doc free cap

backup_manifests(id PK, user_id, version, created_at, size_bytes,
                 client_meta jsonb)        -- no plaintext doc metadata
backup_blobs → Supabase Storage bucket 'backups/{user_id}/...' (ciphertext only)

consent_events(id PK, user_id, consent_key, granted bool, at timestamptz,
               app_version)               -- NDPR audit trail (NFR-SEC-011)

audit_log(id, user_id, event, at, ip_hash) -- security events only, no content
```

Notably absent server-side: document text, OCR output, categories, expiry dates, analysis results — these exist only on-device and inside the opaque encrypted backup. This is the data-minimisation posture (NFR-SEC-006) and it shrinks the breach blast radius (risk register).

### 4.3 Reminders & notifications (ExpiryGuard)

- **Primary = local notifications**, scheduled on-device via Expo Notifications at upload/edit time for each tracked document at T-90/T-30/T-7/T-0 (REQ-EXPIRY-005). Works fully offline (REQ-EXPIRY-009). Rescheduled on date edit, dismissal handling per REQ-EXPIRY-008 (dismiss one, keep the rest).
- **Secondary = email** via Resend (REQ-EXPIRY-006). Because the server doesn't know expiry dates (data minimisation), email reminders work by the *device* registering a minimal reminder record server-side **only if the user opts in to email reminders**: `(user_id, doc_label_chosen_by_user, fire_at)` — the label is user-visible text, not OCR content. A Vercel cron sweeps due rows daily. This is an explicit, documented trade-off; default off.
- Urgency dashboard colour bands (REQ-EXPIRY-011) and renewal guidance content (REQ-EXPIRY-014) are pure client concerns; guidance is a versioned static JSON (per doc type: steps + authority + URL) bundled with the app and remotely updatable via CDN fetch (non-sensitive).

---

## 5. Security Architecture (summary)

| Control | Implementation |
|---|---|
| At rest (device) | AES-256-GCM per file (random DEK) + encrypted SQLite; keys in Keychain/Keystore via `react-native-encrypted-storage` |
| At rest (cloud) | Client-side AES-256-GCM with password-derived KEK (Argon2id, per-user salt); Supabase server-side encryption as defence-in-depth only |
| In transit | TLS 1.3 minimum, certificate pinning in the app for `api.vaultmind.*` |
| AuthN | Supabase Auth: email+password (complexity per REQ-AUTH-002), email verification gate, MFA mandatory day-one (TOTP preferred; SMS OTP fallback), biometric unlock as *local* re-auth only (never replaces MFA for new sessions) |
| Sessions | 30-min inactivity expiry; access token TTL 15 min + refresh rotation; refresh revoked on logout/password change |
| Consent enforcement | `consent` package: every egress call site must pass a `ConsentToken` minted only when the flag is granted; lint rule bans direct `fetch` of document content outside `api-client` |
| Erasure | Crypto-shredding locally; server purge jobs ≤24h/≤72h with completion audit events |
| Secrets | Anthropic/Google/Paystack/Resend keys only in Vercel env; nothing secret in the app bundle |
| Pen test | Pre-launch (Phase 4) scope: API routes, auth flows, backup zero-knowledge claim, mobile storage extraction on rooted device |

---

## 6. ContractScan — AI Architecture

### 6.1 Tier routing

```
contract uploaded (PDF/JPG/PNG, ≤50pp)
  → page count + device RAM + local-model confidence pre-check
  ├─ ≤10 pages AND device supports 3B model → Tier 1 (on-device, no egress)  [REQ-CONTRACT-004]
  └─ >10 pages OR multi-party OR low local confidence OR user chose "deeper analysis"
       → non-dismissable consent gate (exact PRD copy, "I Understand, Proceed" /
         "Analyse Locally Only")                                            [REQ-CONTRACT-005]
       → Tier 2: POST /api/contractscan/analyze
```

Both tiers emit the **same result schema** (below), saved encrypted to the vault next to the source document (REQ-CONTRACT-010), re-runnable any time (REQ-CONTRACT-011), always rendered with the legal disclaimer (REQ-CONTRACT-009).

### 6.2 Result schema (shared by Tier 1 and Tier 2)

```json
{
  "type": "object",
  "properties": {
    "document_summary": {
      "type": "object",
      "properties": {
        "contract_type": {"type": "string"},
        "parties": {"type": "array", "items": {"type": "string"}},
        "plain_english_summary": {"type": "string"}
      },
      "required": ["contract_type", "parties", "plain_english_summary"],
      "additionalProperties": false
    },
    "your_obligations": {"type": "array", "items": {"type": "string"}},
    "other_party_obligations": {"type": "array", "items": {"type": "string"}},
    "important_dates": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "label": {"type": "string"},
          "date_or_rule": {"type": "string"},
          "explanation": {"type": "string"}
        },
        "required": ["label", "date_or_rule", "explanation"],
        "additionalProperties": false
      }
    },
    "red_flags": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "original_clause_text": {"type": "string"},
          "plain_english_explanation": {"type": "string"},
          "severity": {"type": "string", "enum": ["note", "caution", "serious"]}
        },
        "required": ["original_clause_text", "plain_english_explanation", "severity"],
        "additionalProperties": false
      }
    },
    "verdict": {
      "type": "string",
      "enum": ["standard", "review_before_signing", "seek_legal_advice"]
    }
  },
  "required": ["document_summary", "your_obligations", "other_party_obligations",
               "important_dates", "red_flags", "verdict"],
  "additionalProperties": false
}
```

This maps 1:1 to the six output sections of REQ-CONTRACT-006 and drives the structured results screen (REQ-CONTRACT-007/008) — never a raw text dump.

### 6.3 Tier 2 — Claude API integration (server-side proxy)

The mobile app never talks to Anthropic directly. `/api/contractscan/analyze` (Node, TypeScript, official `@anthropic-ai/sdk`):

1. **Verify** JWT, entitlement, and usage counter (free tier: 2/month, REQ-CONTRACT-012); verify the request carries the Tier-2 consent token.
2. **Receive** the document over TLS as base64 (PDF) or images. Held in memory only — no disk, no object storage, no logging of content.
3. **Call Claude** and **stream** progress events back to the app (SSE) to satisfy the ≤60s + progress-indicator requirement (NFR-PERF-005).
4. **Return** the validated JSON result; the buffer is released. Nothing persisted server-side except a usage-counter increment and a content-free audit event.

Request shape:

```ts
const stream = client.messages.stream({
  model: "claude-sonnet-4-6",            // per PRD §6; see model note below
  max_tokens: 16000,
  system: [{
    type: "text",
    text: CONTRACTSCAN_SYSTEM_PROMPT,    // frozen analysis instructions, Nigerian-law
    cache_control: { type: "ephemeral" } // context framing, plain-English style guide
  }],                                    // → prompt-cached across all users' requests
  messages: [{
    role: "user",
    content: [
      { type: "document", source: { type: "base64", data: pdfBase64 } }, // PDF input
      { type: "text", text: "Analyse this contract for the signing party named by the user: ..." }
    ]
  }],
  output_config: {
    format: { type: "json_schema", schema: CONTRACT_ANALYSIS_SCHEMA } // §6.2 — guaranteed
  }                                                                   // valid JSON
});
const message = await stream.finalMessage();
```

Implementation notes:

- **Model.** The PRD specifies `claude-sonnet-4-6` — a sound cost/latency/quality fit for this workload ($3 in / $15 out per MTok; a 30-page contract ≈ tens of thousands of input tokens, so unit cost stays well inside the ₦3,500/mo price point). If red-flag recall on Nigerian tenancy/loan agreements underperforms during Phase 3 evals, `claude-opus-4-8` ($5/$25) is a drop-in upgrade on the same request shape — make the model ID a config value and A/B it.
- **Structured outputs** (`output_config.format` with the §6.2 schema) guarantee schema-valid JSON — no parse-retry loops. First request per schema pays a one-time compilation cost; thereafter cached 24h.
- **Prompt caching** on the system prompt cuts input cost ~90% on the cached span across requests (it's shared by all users; keep it byte-stable — no timestamps or per-user interpolation).
- **PDF input** is native (document content block, base64). Images (photographed contracts) go as image blocks. The 50-page PRD cap is inside the API's PDF limits.
- **Streaming** protects against HTTP timeouts on long analyses and feeds the progress UI.
- **Error handling:** typed SDK exceptions; map 429/529 to a friendly "busy, retrying" state with the SDK's built-in backoff; check `stop_reason` — surface a `refusal` as "this document couldn't be analysed" with the local-only option; `max_tokens` → retry at a higher cap.
- **Retention / "ephemeral" claim (compliance action item).** REQ-CONTRACT-005's consent copy promises "processed immediately and permanently deleted — never stored on our servers." On *our* servers that's enforced by the in-memory design above. For Anthropic's side, API inputs/outputs are subject to Anthropic's retention policy — **before launch, obtain a zero-data-retention (ZDR) arrangement for the organisation, or align the consent-screen wording with the provider's actual retention terms.** Also enable the org setting to exclude data from training (default) and record this in the NDPR records of processing. Owner: founder; due: Phase 3 exit.

### 6.4 Tier 1 — local analysis

- Map-reduce over page chunks with the 3B model: per-chunk extraction (obligations, dates, unusual clauses) → merge pass → verdict heuristic (any `serious` red flag ⇒ at least `review_before_signing`; verdict can only be escalated by the merge step, never relaxed).
- GBNF grammar constrains output to the §6.2 schema.
- A visible "analysed on-device — results may be less detailed" note when Tier 1 was chosen over an offered Tier 2 (per REQ-CONTRACT-005).
- 30s target on 10 pages (NFR-PERF-004): benchmark on a 2022 mid-range Android in Phase 3 week 1; if missed, reduce Tier-1 page ceiling and route the remainder to Tier 2 with consent — set this expectation in UI (risk register: on-device quality).

---

## 7. Payments & Entitlements

- **Paystack** standard checkout from the app via an in-app browser → `/api/billing/init` creates the transaction; webhook (`charge.success`, `subscription.*`) is the source of truth and writes `entitlements`.
- Early-access pricing (₦1,500/₦4,000 locked 12 months) = Paystack plans + `early_access_lock_until` guard in the webhook handler.
- The app caches the entitlement with a signed, short-TTL claim so tier checks (50-doc cap, 5 ExpiryGuard docs on free, ContractScan quota, backup availability) work offline; hard enforcement of *server-side* features (backup, Tier 2) happens server-side regardless.
- Free-tier limits are enforced in the domain layer with clear upgrade prompts (conversion metric #3/#4).

---

## 8. NDPR / Privacy Engineering

- **Consent Centre** screen: granular toggles for (a) core processing, (b) optional analytics, (c) cloud OCR fallback, (d) cloud backup, (e) Tier-2 AI — each with plain-English copy (REQ-ONB-002/003); every change appends to `consent_events`.
- **Analytics:** opt-in only, event names only (no document content, no OCR text — NFR-SEC-006). Recommend PostHog EU/self-host or Vercel Analytics.
- **DSR endpoints:** export (NFR-SEC-008) and erasure (NFR-SEC-007) are API-first so support never touches data manually.
- **Records:** privacy notice published in Phase 0 (PRD timeline); data-flow register kept in `docs/privacy/` and updated per ADR.

---

## 9. Observability & Reliability

- **Crash reporting:** Sentry (React Native + Vercel), PII-scrubbed, target <0.5% crash sessions (NFR-REL-004).
- **Backend:** Vercel logs + uptime monitor on `/api/health`; 99.5% target (NFR-REL-001) is comfortably within Vercel/Supabase SLAs; local-first design means an outage degrades only backup/Tier-2/billing (NFR-REL-002).
- **Retries:** exponential backoff with jitter in `api-client` for all network ops (NFR-REL-003); job queue retries for OCR/AI pipeline steps.
- **Perf budgets in CI:** cold-start trace (<3s mid-range Android), search benchmark fixture (200 docs <2s), bundle-size gate.

---

## 10. Key Architecture Decisions (ADR index)

| # | Decision | Rationale / alternative rejected |
|---|---|---|
| ADR-001 | SQLite+FTS5 for search, no embeddings in MVP | Meets perf target offline; embeddings add model weight + complexity without validating core hypotheses |
| ADR-002 | Local notifications primary, server email secondary & opt-in | Only design that satisfies both REQ-EXPIRY-009 (offline) and NFR-SEC-006 (server doesn't learn expiry data by default) |
| ADR-003 | AI models downloaded on first run over Wi-Fi (not bundled) | Keeps store binary small (App Store risk); bundle Tesseract data only |
| ADR-004 | Tier-2 via server proxy, never direct from device | API key protection, usage metering, single egress chokepoint for consent enforcement |
| ADR-005 | Backup = opaque encrypted blobs + manifest, not row-level sync | Zero-knowledge requirement rules out server-readable rows; full sync is explicitly Phase 2 |
| ADR-006 | Claude model ID is config, default `claude-sonnet-4-6` per PRD | Allows Opus 4.8 A/B for red-flag recall without an app release |
| ADR-007 | Password-derived KEK means backups unrecoverable on password loss | Direct consequence of NFR-SEC-003; mitigated by recovery-phrase option considered for Phase 2 |

---

## 11. Open Questions (resolve before/with the user)

1. **SMS OTP provider for Nigerian numbers** (Termii vs Twilio) — cost and deliverability differ materially in-market; REQ-AUTH-004 needs one in Phase 0.
2. **Anthropic ZDR / retention agreement** — see §6.3; the consent copy depends on it.
3. **Recovery story for zero-knowledge backups** — accept "password loss = backup loss" for MVP, or add an optional recovery phrase (extra scope)?
4. **Family tier in MVP billing?** PRD prices it but defers Family *Profiles* — recommend selling Personal only at launch and waitlisting Family to avoid building entitlements for an unbuilt feature.
