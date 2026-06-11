# VaultMind

**Privacy-first AI-powered personal document intelligence platform** for Nigerian and African professionals.

> "VaultMind turns your documents from dead storage into living intelligence — privately, securely, and on your terms."

## MVP Scope (VaultMind Personal — Early Access)

| Module | What it does |
|---|---|
| **Smart Document Vault** | Encrypted local storage, on-device OCR, AI auto-categorisation, plain-English search |
| **ExpiryGuard** | Automatic expiry-date detection, offline reminder engine with per-doc-type effective-expiry policies, travel-readiness check, urgency dashboard |
| **ContractScan Lite** | Plain-English contract analysis — subscriber's choice of on-device SLM (private, ≤10 pages) or consent-gated cloud LLM (Claude API) for deeper analysis |

## Documents

| Document | Purpose |
|---|---|
| `VaultMind_PRD_v1.0.docx` | Product Requirements Document (source of truth for scope) |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture: local-first design, zero-knowledge encryption with recovery phrase, AI pipeline (Tesseract / on-device SLMs / Claude API), data model, security, ADRs |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | 16-week phased build plan mapped to PRD phases, with exit criteria, risk burn-down, and metric instrumentation |

## Stack (summary)

React Native + Expo · Next.js API routes on Vercel · Supabase (Postgres/Auth/Storage) · Tesseract + on-device SLMs (Phi-3.5 Mini / Gemma 2 / Llama 3.2 1B) · Anthropic Claude API (cloud LLM tier) · Paystack · Resend · Expo Push

## Architecture in one paragraph

Documents never leave the device by default. All content is AES-256-GCM encrypted at rest with hardware-backed keys; search, categorisation, and reminders run fully offline on small language models sized for the market's hardware. Three consent-gated egress paths exist — cloud OCR fallback, cloud LLM contract analysis (ephemeral, server-side proxy to Claude, chosen by the subscriber), and opt-in cloud backup including a free 5 GB allowance (client-side encrypted with a password- or recovery-phrase-derived key, so the server is zero-knowledge). The backend is a thin stateless layer for auth, billing, email, and those three proxied flows.
