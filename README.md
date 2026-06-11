# VaultMind

**Privacy-first AI-powered personal document intelligence platform** for Nigerian and African professionals.

> "VaultMind turns your documents from dead storage into living intelligence — privately, securely, and on your terms."

## MVP Scope (VaultMind Personal — Early Access)

| Module | What it does |
|---|---|
| **Smart Document Vault** | Encrypted local storage, on-device OCR, AI auto-categorisation, plain-English search |
| **ExpiryGuard** | Automatic expiry-date detection, offline reminder engine (90/30/7/0 days), urgency dashboard |
| **ContractScan Lite** | Plain-English contract analysis — on-device for ≤10 pages, consent-gated Claude API for deeper analysis |

## Documents

| Document | Purpose |
|---|---|
| `VaultMind_PRD_v1.0.docx` | Product Requirements Document (source of truth for scope) |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture: local-first design, zero-knowledge encryption, AI pipeline (Tesseract / Llama 3.2 / Claude API), data model, security, ADRs |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | 16-week phased build plan mapped to PRD phases, with exit criteria, risk burn-down, and metric instrumentation |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Decision log resolving the PR-review risks & open questions: free-tier backup, recovery phrase, SLM/LLM split, NDPA 2023, third-party retention posture, pricing, scope |

## Stack (summary)

React Native + Expo · Next.js API routes on Vercel · Supabase (Postgres/Auth/Storage) · Tesseract + Llama 3.2 (on-device AI) · Anthropic Claude API (ContractScan Tier 2) · Paystack · Resend · Expo Push

## Architecture in one paragraph

Documents never leave the device by default. All content is AES-256-GCM encrypted at rest with hardware-backed keys; search, categorisation, and reminders run fully offline. Three consent-gated egress paths exist — cloud OCR fallback, Tier-2 contract analysis (ephemeral, server-side proxy to Claude), and opt-in cloud backup (client-side encrypted with a password-derived key, so the server is zero-knowledge). The backend is a thin stateless layer for auth, billing, email, and those three proxied flows.
