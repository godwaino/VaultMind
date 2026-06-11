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
│  └───────────┘  └───────────┘  │ SLM (llama │                                   │
│                                │ .rn / ONNX)│                                   │
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
packages/consent/        # consent registry, gate enforcement, NDPA audit log
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
User password ──Argon2id──► KEK (backup encryption key, derived on device, never stored/sent)
Recovery phrase ──Argon2id──► same KEK seed (alternative derivation path, shown once at backup setup)
Device random ─────────────► LMK (local master key, stored in Keychain/Keystore)
LMK ──wraps──► per-file DEKs and SQLite DB key
KEK ──wraps──► backup envelope key (only when cloud backup enabled)
```

- Local at-rest encryption is independent of the password (so biometric unlock works offline without re-deriving the KEK).
- Backup encryption uses the password-derived KEK → server is zero-knowledge (NFR-SEC-003).
- **Recovery phrase (mitigates the "forgotten password = lost backup" problem).** When a user enables cloud backup, the app generates a 12-word BIP39 mnemonic equivalent to the KEK seed. It is displayed once with a strong "write this down — VaultMind cannot recover it" prompt; it is never stored by VaultMind. On recovery, the user enters the phrase, the app re-derives the KEK, and decrypts the backup. The Backup consent screen (REQ-VAULT-024) must name both paths clearly: "You can restore your backup with your password OR your recovery phrase."
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

On-device processing exclusively uses **Small Language Models (SLMs)** — purpose-built for edge deployment, typically 1–4B parameters in 4-bit quantisation, runnable within 1–2 GB RAM. This is distinct from the cloud path, which uses a full LLM (Claude API). The subscriber chooses their preferred processing mode in Settings → Document Analysis (see §6.1 for the choice mechanism).

| Task | Model | Runtime | RAM budget | Notes |
|---|---|---|---|---|
| OCR | Tesseract | `react-native-tesseract-ocr` | ~150 MB | eng traineddata bundled; preprocessing (deskew, binarise) before OCR materially lifts accuracy on phone photos |
| Classification + metadata extraction | Llama 3.2 1B Q4 | `llama.rn` | ~700 MB | Constrained generation (GBNF grammar) to force JSON output; adequate for structured field extraction |
| ContractScan Tier 1 — mid-range path | Phi-3.5 Mini 3.8B Q4 | `llama.rn` | ~2.2 GB | Microsoft's purpose-built mobile SLM; outperforms Llama 3.2 3B on legal reasoning; device RAM gate ≥3 GB free |
| ContractScan Tier 1 — low-end path | Gemma 2 2B Q4 | `llama.rn` | ~1.3 GB | Fallback for <3 GB free RAM; lower recall, visible "summary-only" notice; user is offered Tier 2 upgrade |

**Model selection logic (ContractScan Tier 1):**
```
device free RAM ≥ 3 GB → Phi-3.5 Mini 3.8B Q4
device free RAM 1.5–3 GB → Gemma 2 2B Q4 (summary-only notice)
device free RAM < 1.5 GB → Tier 1 unavailable → offer Tier 2 (with consent) or defer
```

Models are downloaded on first use over Wi-Fi (ADR-003) to keep the store binary small. The 1B classification model (~700 MB) may be bundled in a future release once typical device storage headroom is validated in beta.

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

profiles(user_id PK, email, phone_e164, mfa_method, ndpa_consents jsonb,
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
               app_version)               -- NDPA audit trail (NFR-SEC-011)

audit_log(id, user_id, event, at, ip_hash) -- security events only, no content
```

Notably absent server-side: document text, OCR output, categories, expiry dates, analysis results — these exist only on-device and inside the opaque encrypted backup. This is the data-minimisation posture (NFR-SEC-006) and it shrinks the breach blast radius (risk register).

### 4.3 Reminders & notifications (ExpiryGuard)

- **Primary = local notifications**, scheduled on-device via Expo Notifications at upload/edit time for each tracked document (REQ-EXPIRY-005). Works fully offline (REQ-EXPIRY-009). Rescheduled on date edit, dismissal handling per REQ-EXPIRY-008 (dismiss one, keep the rest).
- **Per-document-type reminder policies with "effective expiry".** The PRD's flat T-90/30/7/0 schedule fires too late for documents whose *usable* life ends before the printed date. Canonical example: most countries enforce a 6-month passport-validity rule, and NIS renewals take weeks — a passport with 2 months left is already unusable for international travel, and the holder is forced into costly fast-track renewal. Each tracked type therefore carries a policy:

  | Doc type | Effective expiry | Reminder schedule (before *effective* expiry) | Rationale |
  |---|---|---|---|
  | International Passport | printed − 6 months | 6m, 3m, 1m, 7d, day-of | 6-month validity rule + NIS renewal lead time |
  | Visa / Work Permit | printed date | 90/30/7/0 + renewal-window note per visa class | Some classes must renew before a window closes |
  | Driver's / Vehicle Licence | printed date | 60/30/7/0 | FRSC renewal is days-to-weeks |
  | Insurance Policies | printed date | 30/14/7/0 | Lapse = void cover; renewal is fast |
  | Professional Certificates | printed date | 90/30/7/0 | CPD requirements may need months of lead |
  | Tenancy Agreements | printed date | 90/60/30/0 | Notice periods are typically 1–3 months |
  | WAEC/NECO Attestation | printed date | 90/30/7/0 | Default |

  Policies live in the same versioned, remotely-updatable JSON as the renewal-guidance content; the T-90/30/7/0 default remains for unknown/manual types, satisfying REQ-EXPIRY-005 as the floor while fixing its passport blind spot. Reminder copy names the effective deadline explicitly ("Your passport must be renewed by March for travel after September").
- **Travel-readiness check (lightweight, high-leverage).** A single action — "I'm travelling on ⟨date⟩ to ⟨region⟩" — that evaluates every travel-relevant tracked document (passport effective validity, visa, vaccination card) against the trip date and flags failures *now* rather than at the next scheduled reminder. Pure client-side computation over data ExpiryGuard already holds; no new data collection. This is the feature that would have caught the 2-months-left passport a year early.
- **Correction to PRD doc-type list:** the NIN is permanent and the Voter's Card (PVC) does not expire — both are removed from expiry *tracking* (they remain vault categories). The supported-type list should get a pass from someone who processes these documents daily.
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

**Subscriber processing preference** (Settings → Document Analysis). Subscribers choose their default for all contract analyses — the choice is respected on every subsequent run but can be overridden per document:

| Setting | Behaviour |
|---|---|
| **Local SLM** (default, privacy-first) | Analysis stays fully on-device using the SLM tier (§3.5). No data leaves the device. |
| **Cloud LLM** (accuracy-first) | Routes to Tier 2 (Claude API) on every analysis; consent gate shown on first use only. |
| **Ask each time** | Decision prompt appears before each analysis. |

```
contract uploaded (PDF/JPG/PNG, ≤50pp)
  → read subscriber processing preference
  │
  ├─ preference = "Local SLM" OR (preference = "Ask" AND user selects local):
  │    → page count + device RAM check (see §3.5 model selection logic)
  │    ├─ ≤10 pages AND RAM ≥ 1.5 GB → Tier 1 SLM on-device  [REQ-CONTRACT-004]
  │    └─ >10 pages OR RAM < 1.5 GB → inform user; offer Tier 2 with consent gate
  │
  └─ preference = "Cloud LLM" OR (preference = "Ask" AND user selects cloud):
       → non-dismissable consent gate (exact PRD copy, "I Understand, Proceed" /
         "Analyse Locally Only")                                [REQ-CONTRACT-005]
       → Tier 2: POST /api/contractscan/analyze (LLM via Claude API)
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
- **Third-party retention — global best-practice recommendation (decision #7).** REQ-CONTRACT-005 and REQ-VAULT-024 promise variants of "processed immediately and permanently deleted — never stored on our servers." VaultMind's in-memory architecture enforces this for *our* servers. The harder problem is Anthropic (Tier-2 ContractScan) and Google (OCR fallback) — both have their own API data-handling policies. The globally accepted four-step playbook used by privacy-centred SaaS products (GitHub Copilot Enterprise, Notion AI for Enterprise) operating under GDPR/CCPA/PDPA is:

  **Step 1 — Data Processing Agreement (DPA).** Enter a formal DPA with each provider, classifying them as a *data processor* acting solely on VaultMind's instructions (not an independent controller). Both Anthropic and Google Cloud offer standard DPAs (Anthropic: request via API console; Google: Google Cloud DPA under the ToS). This is required under NDPA 2023 for any data transferred to a third party and gives VaultMind contractual audit rights.

  **Step 2 — Zero Data Retention (ZDR).** Anthropic's ZDR option (enabled per-organisation in API settings, or included in enterprise agreements) means API inputs/outputs are not persisted beyond the HTTP request and are excluded from training. Google Cloud Vision similarly does not use API request data for training under its standard DPA terms; disable any analytics/logging for the Vision endpoint in the GCP console. With ZDR + DPA in place, the "immediately processed and permanently deleted" promise is contractually accurate *end-to-end*, not just on VaultMind's servers.

  **Step 3 — Consent wording aligned to actual facts.**
  - **With ZDR in place (recommended path):** "Your document is sent securely to [Anthropic / Google] for analysis. Under our data processing agreement, they process it immediately and do not store it or use it to train AI models. VaultMind's servers process your document in memory only and do not store it. After analysis is complete, no copy exists on any server."
  - **Without ZDR (fallback if ZDR cannot be obtained before launch):** "Your document is sent to [Anthropic / Google] for analysis. VaultMind does not store your document, but [Anthropic / Google] processes it subject to their API Privacy Policy [link]. Neither VaultMind's servers nor [Anthropic / Google] use your document for AI training." — *Never promise what you cannot control.*

  **Step 4 — Minimum-surface data hygiene (defense-in-depth).** Prefer passing OCR-extracted text rather than the raw file image/PDF where the task permits — this reduces the sensitivity class of data the provider touches even if retention terms are identical.

  **Action items (owner: founder; due: Phase 3 exit, blocking ContractScan and OCR-fallback launch):**
  - Sign Anthropic DPA; enable ZDR in the API org settings.
  - Sign Google Cloud DPA; verify Vision API logging is disabled for the project.
  - Update consent-screen copy to match the outcome of Step 2 above.
  - Record both DPAs in the NDPA 2023 records of processing (`docs/privacy/records-of-processing.md`).

### 6.4 Tier 1 — local SLM analysis

- Map-reduce over page chunks with the on-device SLM (Phi-3.5 Mini 3.8B Q4 on mid-range, Gemma 2 2B Q4 on low-end per §3.5): per-chunk extraction (obligations, dates, unusual clauses) → merge pass → verdict heuristic (any `serious` red flag ⇒ at least `review_before_signing`; verdict can only be escalated by the merge step, never relaxed).
- GBNF grammar constrains output to the §6.2 schema.
- A visible "analysed on-device — results may be less detailed" note when Tier 1 was chosen over an offered Tier 2 (per REQ-CONTRACT-005). The Gemma 2B path additionally shows "summary-only mode: cloud analysis will be more thorough."
- 30s target on 10 pages (NFR-PERF-004): benchmark Phi-3.5 Mini on a 2022 mid-range Android in Phase 3 week 1; if missed, reduce Tier-1 page ceiling and route the remainder to Tier 2 with consent — set this expectation in UI (risk register: on-device quality).

---

## 7. Payments & Entitlements

- **Paystack** standard checkout from the app via an in-app browser → `/api/billing/init` creates the transaction; webhook (`charge.success`, `subscription.*`) is the source of truth and writes `entitlements`.
- Early-access pricing (₦1,500/₦4,000 locked 12 months) = Paystack plans + `early_access_lock_until` guard in the webhook handler.
- The app caches the entitlement with a signed, short-TTL claim so tier checks (50-doc cap, 5 ExpiryGuard docs on free, ContractScan quota, backup quota) work offline; hard enforcement of *server-side* features (backup, Tier 2) happens server-side regardless.
- Free-tier limits are enforced in the domain layer with clear upgrade prompts (conversion metric #3/#4).

### 7.1 Cloud backup by tier (decision: free tier gets a safety net)

| Tier | Backup allowance | Rationale |
|---|---|---|
| Free | **5 GB**, opt-in, consent-gated | Closes the "stolen phone wipes a free user's vault" gap — the product's core promise ("never lose documents at critical moments") must hold for every user. Local-first addresses *privacy*; it was never meant to mean *anti-cloud*. Users who consent get the safety net; users who don't stay fully local. |
| Personal / Family | Full vault backup (within plan storage) | Existing REQ-VAULT-023..027 behaviour |

All backups — free and paid — use the same zero-knowledge envelope (§3.2: client-side AES-256-GCM, password- or recovery-phrase-derived KEK), the same consent screen (REQ-VAULT-024), and the same remote-wipe path (REQ-VAULT-026). The 5 GB quota is enforced server-side at signed-URL issuance (`/api/backup/*` checks `entitlements` + manifest size). Approaching-quota prompts double as the paid-tier upgrade funnel.

---

## 8. NDPA / Privacy Engineering

> **Compliance target correction:** the PRD cites "NDPR 2019 from day one", but Nigeria's operative regime is the **Nigeria Data Protection Act (NDPA) 2023** with the NDPC as regulator — different registration, breach-notification, and DPO requirements. All consent, records-of-processing, and notice work below targets the NDPA (with NDPR-era guidance where the NDPC has carried it forward).

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
| ADR-007 | 12-word BIP39 recovery phrase ships with cloud backup in MVP | Zero-knowledge (NFR-SEC-003) makes password loss otherwise fatal to backups; a recovery phrase is the simplest customer-centric mitigation that preserves zero-knowledge. Shown once at backup enable, never stored by VaultMind |
| ADR-008 | Per-doc-type reminder policies with "effective expiry" instead of a flat T-90/30/7/0 schedule | A passport with <6 months validity is already unusable for most international travel; flat schedules notify after the real deadline has passed. Policy table is versioned remote JSON; flat schedule remains the default for unknown types |
| ADR-009 | Compliance targets NDPA 2023, not NDPR 2019 | PRD cites the superseded regulation; building consent/records against NDPR means redoing the work |
| ADR-010 | On-device AI = SLMs (Phi-3.5 Mini / Gemma 2 2B / Llama 3.2 1B); cloud = LLM (Claude API); subscriber chooses per Settings preference | SLMs fit the market's 2–4 GB-RAM devices where full LLMs don't; the cloud LLM path serves accuracy-first users. Putting the choice in subscribers' hands aligns with the consent-first posture |
| ADR-011 | Free tier includes an opt-in 5 GB zero-knowledge cloud backup | Device loss must not wipe a free user's vault — the core promise has to hold for everyone. Local-first is a privacy stance, not an anti-cloud stance; consent-gated backup preserves it. Quota prompts feed the upgrade funnel |
| ADR-012 | DPA + ZDR with Anthropic and Google before launch; consent copy matches contractual reality | Global best practice (GDPR Art. 28 model): never claim "never stored" beyond what contracts guarantee. See §6.3 |

---

## 11. Open Questions (resolve before/with the user)

1. **SMS OTP provider for Nigerian numbers** (Termii vs Twilio) — cost and deliverability differ materially in-market; REQ-AUTH-004 needs one in Phase 0.
2. **Family tier in MVP billing?** PRD prices it but defers Family *Profiles* — recommend selling Personal only at launch and waitlisting Family to avoid building entitlements for an unbuilt feature.
3. **SLM benchmark on market hardware.** The SLM direction is decided (ADR-010), but Phi-3.5 Mini vs Gemma 2 2B red-flag recall on Nigerian contracts is unmeasured. The week-1 device spike (see plan) answers RAM/latency; the Phase 3 eval set answers quality. If both SLMs miss the quality bar, Tier 1 ships as "summary-only" with Tier 2 as the recommended path.

### Resolved (previous open questions)

| Question | Resolution |
|---|---|
| Anthropic ZDR / retention | DPA + ZDR before launch; consent copy aligned to contractual reality (§6.3, ADR-012) |
| Recovery story for zero-knowledge backups | 12-word BIP39 recovery phrase ships in MVP (§3.2, ADR-007) |
| Free-tier safety net for device loss | Opt-in 5 GB zero-knowledge backup on free tier (§7.1, ADR-011) |
| On-device model size vs market hardware | SLMs on-device, LLM in cloud, subscriber chooses (§3.5, §6.1, ADR-010) |
