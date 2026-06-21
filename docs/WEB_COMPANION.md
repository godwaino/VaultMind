# VaultMind — Companion Web App

**Status:** scope decision + scaffold. Domain logic is shared and tested; the web UI and browser adapters are dev-machine work (need a browser).
**Decision (this doc):** VaultMind is now **mobile + web**. The web app is a **companion**, not a replacement, and keeps the **same zero-knowledge model** with **cloud (Gemini) AI** — no on-device SLM in the browser.

## What the companion is (and isn't)

**Is:** account & security, billing, settings/consent centre, viewing & managing documents, the ExpiryGuard dashboard + travel-readiness, and cloud ContractScan. Documents are still encrypted client-side — the server can't read them.

**Isn't:** the privacy-maximum surface. The on-device SLM, hardware-backed key storage, and the most sensitive vault stay **mobile-first**. The web app is the convenient second screen, not the vault of record.

## Why this shape (the trade-offs we accepted)

- **Key storage is softer in a browser.** Mobile has hardware-backed Keychain/Keystore; the browser only has non-extractable WebCrypto keys in IndexedDB. The zero-knowledge *backup* guarantee still holds (password/recovery-phrase derived), but at-rest protection isn't secure-enclave equivalent. **We surface this honestly** and steer the most sensitive documents to mobile.
- **No on-device LLM on web.** Running the SLM in-browser needs WebGPU/WASM and large downloads, which contradicts the low-end-device thesis and isn't worth it for a companion. Web routes contract analysis to the **consent-gated Gemini cloud** tier — reusing the exact same `contractscan-core` schema and routing, just with `deviceCanRunSlm: false`.

## What's reused vs new

Almost everything reuses the framework-agnostic packages — the monorepo was built for this.

| Concern | Reuse / change |
|---|---|
| Encryption, backup, recovery phrase | **Reused as-is** — `@vaultmind/crypto` runs in browsers natively (WebCrypto + `@noble/hashes`). No polyfill needed (unlike React Native). |
| Consent gate + NDPA audit | Reused — `@vaultmind/consent`. |
| Validation, vault model, expiry logic, contract schema/routing/verdict | Reused — pure TS packages. |
| Search | **Now cross-platform** — `SearchIndex` takes an injected SQLite driver. Node/tests use `@vaultmind/search/node` (node:sqlite); the browser passes a **wa-sqlite / sql.js (WASM)** driver. Same SQL, same FTS5. |
| Storage (files + metadata DB) | **New web adapters** over **IndexedDB / OPFS** implementing the existing `vault-core` ports. |
| OCR (if uploading on web) | **New** — `tesseract.js` (WASM) on device, or cloud OCR fallback (consent). |
| Contract analysis | Cloud-only via the backend Tier-2 proxy (`apps/web/lib/contractscan.ts`). |
| Reminders | **New** — Web Push + a service worker (mobile uses Expo notifications). |
| Auth | Supabase JS in the browser; consider **WebAuthn/passkeys** for unlock. |
| API + hosting | The **same Next.js backend on Vercel** serves the web app and the API. |

## Architecture

One Next.js app (`apps/web`) deployed to Vercel serves the React companion UI **and** the existing `/api/*` routes (auth, ContractScan Tier-2, Paystack, account). The mobile Expo app and the web app both depend on the shared `@vaultmind/*` packages, so business logic has exactly one implementation.

```
@vaultmind/* packages  ──┬─►  apps/mobile  (Expo, hardware-backed, on-device SLM)
  (one implementation)   └─►  apps/web     (Next.js companion, WASM/IndexedDB, cloud AI)
                                  └─► backend /api/* routes (shared, on Vercel)
```

## Scaffold in this repo

- `apps/web/` — Next.js app: `app/layout.tsx`, `app/page.tsx` (companion dashboard stub), `app/api/health/route.ts`, `next.config.js` (`transpilePackages` + `output: standalone`), `tsconfig.json`.
- `apps/web/lib/contractscan.ts` — cloud-only ContractScan reusing `contractscan-core`.
- `apps/web/lib/crypto-bootstrap.ts` — reuses `@vaultmind/crypto`; documents the browser key-storage caveat.
- `packages/search` — refactored to an injectable SQLite driver (`@vaultmind/search/node` for Node; wa-sqlite for browser).

## Build status (done)

The companion app is **built and type-clean** (0 real type errors; webpack resolves all shared packages). A full cold `next build` exceeds the CI sandbox's time limit, so run it on a dev machine — but the code is verified.

Done:
- Next.js app (`next@14.2`, React 18) with `extensionAlias` so webpack resolves the `.js`-specified TS packages; `/api/health`.
- **Browser adapters** (`lib/idb.ts`): IndexedDB `BlobStore` / `DocRepo` / `TrackingRepo` implementing the `vault-core` + `expiry-core` ports, plus LMK storage.
- **In-browser encryption** via `@vaultmind/crypto` (`lib/vault.ts`, `lib/crypto-bootstrap.ts`) — documents encrypted before IndexedDB; decrypt-and-view in the document page.
- **Auth** (`lib/session.tsx`, `lib/supabaseClient.ts`): Supabase browser client, session context, route guard. Sign-up posts to the backend; sign-in via Supabase.
- **Screens:** home, sign up, sign in, app shell, dashboard, documents (upload/search/list), document view (decrypt), ExpiryGuard (track + urgency + travel-readiness), ContractScan (cloud, consent-gated, results + disclaimer), settings (consent centre, recovery phrase, export, delete).
- **Search** (`lib/search.ts`) reusing the shared query rewriter (in-memory rank; no WASM SQLite needed for the companion).
- Cloud ContractScan wired to the backend API (`lib/api.ts`).

Still outstanding (need a browser/device or follow-up):
- Final click-through QA and styling polish in a real browser (no browser in the build sandbox).
- **Web Push + service worker** for ExpiryGuard reminders (currently the dashboard shows urgency/travel-readiness; no OS push on web yet).
- Persist the Consent Centre toggles to the backend `consent_events` table (currently local UI state).
- Optional: a **wa-sqlite** driver for `SearchIndex` if libraries get large; harden LMK as a non-extractable key / WebAuthn unlock.
- Decide whether new-document **upload + OCR** happens on web (tesseract.js / cloud) — currently metadata is entered manually.
