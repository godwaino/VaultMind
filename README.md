# VaultMind

**Privacy-first AI-powered personal document intelligence platform** for Nigerian and African professionals.

> "VaultMind turns your documents from dead storage into living intelligence — privately, securely, and on your terms."

## MVP Scope (VaultMind Personal — Early Access)

| Module | What it does |
|---|---|
| **Smart Document Vault** | Encrypted local storage, on-device OCR, AI auto-categorisation, plain-English search |
| **ExpiryGuard** | Automatic expiry-date detection, offline reminder engine (90/30/7/0 days), urgency dashboard |
| **ContractScan Lite** | Plain-English contract analysis — on-device SLM for ≤10 pages, consent-gated Gemini API for deeper analysis |

## Documents

| Document | Purpose |
|---|---|
| `VaultMind_PRD_v1.0.docx` | Product Requirements Document (source of truth for scope) |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture: local-first design, zero-knowledge encryption, AI pipeline (Tesseract / on-device SLM / Gemini API), data model, security, ADRs |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | 16-week phased build plan mapped to PRD phases, with exit criteria, risk burn-down, and metric instrumentation |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Decision log resolving the PR-review risks & open questions: free-tier backup, recovery phrase, SLM/LLM split, NDPA 2023, third-party retention posture, pricing, scope |
| [`docs/PHASE0_STATUS.md`](docs/PHASE0_STATUS.md) … [`PHASE4_STATUS.md`](docs/PHASE4_STATUS.md) | Per-phase build status — what's tested vs. stubbed |
| [`docs/OUTSTANDING.md`](docs/OUTSTANDING.md) | Consolidated remaining-work checklist + a "first week on a dev machine" sequence |
| [`docs/WEB_COMPANION.md`](docs/WEB_COMPANION.md) | Web companion app — scope, zero-knowledge-on-web posture, shared-vs-new adapters |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Vercel deployment — two projects, env setup, what's done vs dev-machine steps |
| [`docs/PENTEST_SCOPE.md`](docs/PENTEST_SCOPE.md) | Pre-launch penetration-test scope |
| [`docs/privacy/PRIVACY_NOTICE.md`](docs/privacy/PRIVACY_NOTICE.md) | NDPA 2023 privacy notice (draft for counsel) |

## Monorepo & build status

npm workspaces (TypeScript). Domain logic is built and unit-tested; native/AI/cloud pieces (Expo UI, Tesseract, the SLM, Supabase, Gemini) sit behind injected interfaces with in-memory adapters for tests. **122 tests passing; `tsc -b` clean.**

```bash
npm install
npm run typecheck
npm test          # NODE_OPTIONS=--experimental-sqlite is set by the script (node:sqlite FTS5)
```

### Deploying the backend (Vercel)

`backend/` is a Next.js (App Router) API-only app. In the Vercel project settings set
**Root Directory = `backend`** (leave "Include source files outside of the Root Directory"
enabled so the workspace packages are available). Vercel then detects Next.js, installs at
the repo root via npm workspaces, and serves `/` (health) plus the `/api/*` routes.
Deploying from the repo root yields a `404: NOT_FOUND` because no framework lives there.

| Package | Responsibility | Phase |
|---|---|---|
| `packages/crypto` | AES-256-GCM, Argon2id, zero-knowledge backup keyset + recovery phrase | 0 |
| `packages/consent` | In-code egress gate (ConsentToken) + NDPA audit events | 0 |
| `packages/validation` | Email / password / Nigerian-phone validation, session policy | 0 |
| `packages/vault-core` | Ingestion pipeline, OCR orchestration, dedup, management, free-tier cap | 1 |
| `packages/search` | Offline FTS5 search, query rewrite, BM25 ranking | 1 |
| `packages/expiry-core` | Effective-expiry reminder policies, travel-readiness, urgency, guidance | 2 |
| `packages/contractscan-core` | Shared result schema, tier routing, verdict rules, Tier-1 SLM analysis | 3 |
| `packages/backup-core` | Client-side encrypted backup, restore, manifest, remote wipe | 4 |
| `backend/` | Next.js route logic: auth, ContractScan Tier-2 proxy, Paystack, account | 0–4 |
| `supabase/` | Schema migrations + RLS + storage policies | 0 |
| `apps/mobile/` | Expo mobile app — hardware-backed, on-device SLM (structural stub) | 0+ |
| `apps/web/` | Next.js **companion web app** — shares packages; cloud AI, in-browser encryption (structural stub) | — |

## Stack (summary)

**Mobile:** React Native + Expo (hardware-backed, on-device SLM). **Web companion:** Next.js on Vercel (in-browser encryption, cloud AI) — see [`docs/WEB_COMPANION.md`](docs/WEB_COMPANION.md).

Shared backend: Next.js API routes on Vercel · Supabase (Postgres/Auth/Storage) · Tesseract + on-device SLM (Llama 3.2-class) · Google Gemini API — paid/Vertex (ContractScan Tier 2) · Paystack · Resend · Expo Push / Web Push

## Architecture in one paragraph

Documents never leave the device by default. All content is AES-256-GCM encrypted at rest with hardware-backed keys; search, categorisation, and reminders run fully offline. Three consent-gated egress paths exist — cloud OCR fallback, Tier-2 contract analysis (ephemeral, server-side proxy to Gemini), and opt-in cloud backup (client-side encrypted with a password-derived key, so the server is zero-knowledge). The backend is a thin stateless layer for auth, billing, email, and those three proxied flows.
