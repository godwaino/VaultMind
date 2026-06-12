# Phase 0 — Foundations: Status

**Branch:** `claude/phase-0-foundations`
**Plan reference:** `docs/IMPLEMENTATION_PLAN.md` → Phase 0 (Weeks 1–3).
**Exit criteria (PRD):** user can register, verify email, set up MFA, and log in securely.

This document is the honest line between what is **built and tested now** and what is a **documented interface/stub** awaiting a dev machine with the native toolchain and a provisioned Supabase project (per your "interfaces + stubs + notes" choice).

## What runs and is tested now (Node/TypeScript)

| Area | Package | Tests |
|---|---|---|
| Encryption layer: AES-256-GCM envelope, per-file DEK wrapping, crypto-shredding | `packages/crypto` | tamper test, wrong-key, AAD binding, file round-trip |
| Zero-knowledge backup keyset + **recovery phrase** + recovery kit (DECISIONS #1/#2) | `packages/crypto` | password unlock, recovery unlock, re-wrap, kit round-trip |
| Argon2id KDF (backup KEK) | `packages/crypto` | determinism, salt separation |
| Consent registry + in-code egress gate + NDPA audit events | `packages/consent` | gate-blocks-without-consent, audit trail |
| Auth input validation: email, password complexity, Nigerian phone → E.164, session policy | `packages/validation` | 20 cases incl. NG phone formats |
| Registration business logic (validate → create user → seed consents → verification) | `backend/lib/auth` | 201/400/409 paths, consent seeding |

Run them:

```bash
npm install      # first time / after adding a workspace package
npm test         # vitest across all packages  (48 tests)
npm run typecheck
```

## Built as files, applied off-box

| Area | Location | Applied by |
|---|---|---|
| Monorepo + workspaces + TS project refs | root `package.json`, `tsconfig*.json` | — |
| CI: typecheck + unit tests on every PR | `.github/workflows/ci.yml` | GitHub Actions |
| DB schema v1 + RLS (profiles, entitlements, usage_counters, backup_manifests, consent_events, audit_log) | `supabase/migrations/0001_init.sql` | `supabase db push` |
| Encrypted-backup storage bucket + owner-only policies | `supabase/migrations/0002_storage_backups.sql` | `supabase db push` |
| NDPA 2023 privacy notice (draft for counsel) | `docs/privacy/PRIVACY_NOTICE.md` | legal review → publish |

## Interfaces + stubs (need native runtime / live services)

- **`backend/app/api/auth/register/route.ts`** — real Next.js App Router handler; the Supabase `AuthProvider`/`ProfileStore` adapters are placeholders. Wire `@supabase/supabase-js` (service-role key, Vercel env) to the `ports.ts` interfaces; the tested logic underneath doesn't change.
- **`apps/mobile/`** — Expo structural stub. `src/onboarding/ConsentCentre.tsx` shows the UI binding to `@vaultmind/consent`. Needs the native toolchain (Expo, react-native, `react-native-get-random-values`, a WebCrypto `subtle` polyfill, `expo-secure-store`/`react-native-encrypted-storage`, `expo-sqlite`) installed on a dev machine.
- **MFA (TOTP/SMS), email verification, biometric unlock** — interfaces are implied by the schema and session-policy constants; the Supabase Auth wiring and the **Termii-vs-Twilio** SMS decision are the first Phase-0 dev-machine tasks (still-open question, DECISIONS.md).

## Phase 0 exit checklist (PRD)

- [x] Repo, workspaces, CI, branch protection config
- [x] Encryption layer with tests (incl. recovery phrase, MVP per DECISIONS #2)
- [x] DB schema + RLS + storage policies (free-tier backup per DECISIONS #1)
- [x] Consent engine + NDPA audit trail; privacy notice draft
- [x] Registration logic + validation (tested)
- [ ] Supabase project provisioned; Auth adapters wired to `ports.ts`
- [ ] Email verification + MFA (TOTP first; SMS provider decision)
- [ ] Biometric unlock on device
- [ ] Expo app builds via EAS (dev profile) on a dev machine

The unchecked items all require a provisioned Supabase project and the native toolchain; everything checkable in a pure Node/TS environment is done and green.
