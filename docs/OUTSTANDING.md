# VaultMind — Outstanding Work

**As of:** end of the Phase 0–4 logic build (122 tests passing, `tsc -b` clean).
**What this is:** the consolidated list of everything still to do. The domain logic for all four phases is built and tested behind clean adapter interfaces; what remains needs a **device**, a **live service**, the **security audit**, or **store/legal operations** — none of which can run in a pure Node/TS environment.

Legend: ☐ todo · 🔴 blocker / do first · effort is a rough solo-dev estimate.

---

## A. Resolve first (gate everything else)

- ☐ 🔴 **Provision Supabase** (project, Auth config, run `supabase/migrations/*`, storage bucket). First domino — auth, entitlements, backup transport, erasure all depend on it. _~1 day._
- ☐ 🔴 **Week-1 device test of the SLM** on a representative 3–4 GB-RAM Android (Tecno/Infinix): load time, RAM headroom, 10-page latency **and quality**. Fixes the exact model; if it fails, descope Tier-1 ContractScan to cloud-only now (DECISIONS #3/#8). _~2–3 days._
- ☐ 🔴 **On-device model quality / eval sets** — the biggest real-world risk. Build the 100-doc categorisation eval set and the ≥20-contract red-flag set; they are the quality gate the unit tests can't be. _Ongoing; start week 1._
- ☐ 🔴 **Per-project Gemini ZDR request** on the paid tier (or ship the accurate-disclosure consent copy) — DECISIONS #7. Blocks the "permanently deleted" wording. Use the paid Gemini API/Vertex (not free AI Studio, which trains on data); do the equivalent for Google Vision (or a no-retention OCR path). _Request/approval lead time — start early._
- ☐ **SMS OTP provider decision** — Termii vs Twilio (cost + deliverability in Nigeria). _~0.5 day to spike._

## A2. Web companion (new — ADR-012, see `docs/WEB_COMPANION.md`)

- ☐ Scaffold the real Next.js app deps (`next`, `react`) in `apps/web`; wire Supabase auth in the browser (consider WebAuthn/passkeys for unlock).
- ☐ Browser storage adapters: IndexedDB/OPFS file + metadata stores implementing the `vault-core` ports; a **wa-sqlite** driver for `SearchIndex` (the package is already driver-injectable).
- ☐ Decrypt-and-view flow (WebCrypto) with the LMK as a non-extractable IndexedDB key; honest in-product messaging about web vs mobile key storage.
- ☐ Web Push + service worker for ExpiryGuard reminders.
- ☐ Tier-2 ContractScan UI (consent gate → cloud Gemini → results/disclaimer); analysis is already cloud-routed (`apps/web/lib/contractscan.ts`).
- ☐ Decide whether new-document upload + OCR runs on web (tesseract.js / cloud) or stays mobile-only at launch.

## A3. Deployment to Vercel (see `docs/DEPLOY.md`)

- ☑ Routes **degrade gracefully** — unconfigured integrations return `501 not_configured` instead of crashing (done + tested).
- ☑ **Health checks** — `GET /api/health` on both the API and web projects (done + tested).
- ☑ `next.config.js` for both projects (`transpilePackages` + `output: standalone`).
- ☐ On a dev machine: `npm install next react react-dom` in `backend/` and `apps/web/`, run `next build`, commit the updated lockfile (the Next toolchain isn't installed in the test sandbox).
- ☐ Create the two Vercel projects (root dirs `backend` and `apps/web`); set env from `.env.example`; `supabase db push` before first traffic.

## B. Cross-cutting (touch every phase)

- ☐ **Expo app shell** — navigation, theming, the screens listed per phase below.
- ☐ **Native crypto setup** — import `react-native-get-random-values` at entry + a WebCrypto `subtle` polyfill (e.g. react-native-quick-crypto) before any `@vaultmind/crypto` call.
- ☐ **Swap in-memory adapters for device adapters** — `expo-sqlite` (encrypted metadata DB + job + tracking stores) and `expo-file-system` (encrypted file/blob store) implementing the existing `ports.ts` shapes.
- ☐ **EAS build pipeline** (dev profile) + wire the placeholder CI gates (expo-eas-build, supabase-migration-check, vercel-preview).

## C. Phase 0 — Foundations

- ☐ Wire Supabase Auth to `backend/lib/ports.ts` (`AuthProvider`, `ProfileStore`).
- ☐ Email verification gate (Resend).
- ☐ MFA: TOTP enrolment + SMS OTP fallback (provider per A).
- ☐ Biometric unlock (local re-auth only) via Keychain/Keystore.
- ☐ Recovery-phrase / recovery-kit **UI** (crypto is done and tested).

## D. Phase 1 — Smart Document Vault

- ☐ Tesseract OCR adapter (deskew/binarise) behind `OcrProvider`; benchmark ≤10s/page on a 2022 mid-range Android.
- ☐ SLM adapters behind `MetadataExtractor` + `Categoriser` (GBNF-constrained JSON).
- ☐ Categorisation eval set ≥ quality gate (see A).
- ☐ Vault UI: camera/gallery/file pickers, upload progress, metadata review screen, dashboard, 3-taps audit.
- ☐ Compression rendition for low-storage devices (persistence-layer concern).

## E. Phase 2 — ExpiryGuard

- ☐ **Expo Notifications adapter** behind `NotificationScheduler` — delivers the real device push (the literal PRD exit criterion). _Highest-value Phase-2 wiring._
- ☐ `expo-sqlite` tracking repo in place of the in-memory one.
- ☐ Email channel adapter: Vercel cron sweeping `(label, fireAt)` rows + Resend (opt-in, default off).
- ☐ ExpiryGuard dashboard UI (urgency bands, sorting, expired "Renew/Update" card) + the "I'm travelling on…" entry point.
- ☐ Time-travel QA pass on a device across the full schedule matrix.

## F. Phase 3 — ContractScan Lite

- ☐ SLM adapter behind `SlmContractAnalyzer` (Tier 1).
- ☐ Gemini adapter behind `CloudContractAnalyzer` (Tier 2): `@google/genai`, model `gemini-2.5-pro` from config (paid/Vertex), `responseSchema = CONTRACT_ANALYSIS_SCHEMA`, **SSE streaming**, in-memory only, no Search/Maps grounding or explicit caching.
- ☐ Contract eval set meeting the red-flag recall bar (A/B `gemini-2.5-flash` or a Gemini 3 model if Pro underperforms).
- ☐ Per-project Gemini ZDR (see A) — blocks consent copy.
- ☐ Results UI (clause-beside-explanation, non-dismissable disclaimer, re-run, free-tier counter display).
- ☐ Tier-2 ≤60s latency validation with the progress indicator.

## G. Phase 4 — Launch

- ☐ Paystack checkout E2E (init/verify, in-app browser) with real cards / bank transfer / USSD; wire `EntitlementWriter` (Supabase service role).
- ☐ Backup wired to Supabase Storage signed URLs behind `BackupTransport` + the restore/recovery UI on device.
- ☐ Erasure ports → Supabase row updates + a scheduled purge job (Vercel cron).
- ☐ **Penetration test** — scope in `docs/PENTEST_SCOPE.md`; book the vendor **week 11**; clear Critical/High before submission.
- ☐ Store submissions: iOS (start of week 15, 2-week buffer) + Play Store; encryption export-compliance + data-safety forms aligned to the privacy notice; ASO copy.
- ☐ 20 internal beta users onboarded; activation funnel instrumented (register → first upload → first search → first reminder → first scan).

## H. Outside the build (don't forget)

- ☐ 🔴 **Pre-build validation gate** (PRD precondition) — landing page + willingness-to-pay at the **real** price (₦1,500 early access / ₦3,500), gate ≥40 sign-ups & ≥15 willing-to-pay before Phase 0. _This is meant to happen before any of the above._
- ☐ **Privacy notice** → counsel/DPO review before publishing; **NDPC registration** + **DPO appointment** under the NDPA.
- ☐ Confirm **Personal-only launch**, Family waitlisted (don't ship billing for the unbuilt Family Profiles) — DECISIONS nit B.

---

## First week on a dev machine — suggested sequence

A concrete order that respects the dependencies above. Assumes the pre-build validation gate (H) has passed.

| Day | Focus | Outcome |
|---|---|---|
| **1** | Provision Supabase; run migrations; scaffold the Expo app + native crypto setup (B). | App boots; DB + RLS live. |
| **1–2** | Wire `AuthProvider`/`ProfileStore` to Supabase Auth; email verification. | Register → verify → log in works against the tested logic. |
| **2–3** | **SLM device spike** (A) on a real low/mid-range Android. | Go/no-go on Tier-1; the exact SLM is fixed (or Tier-1 descoped). |
| **3–4** | `expo-sqlite` + `expo-file-system` adapters implementing the `ports.ts` shapes; run the Phase-1 pipeline on-device with the Tesseract adapter. | A real document ingests, encrypts, OCRs on a phone. |
| **4–5** | Categorisation eval set v1; wire the SLM `Categoriser`/`MetadataExtractor`. | First measured categorisation accuracy number. |
| **parallel** | File the **Gemini ZDR** request (paid project) and pick the SMS provider — both have lead time. | Approval clocks started early. |

After week 1 the critical unknowns (model viability, on-device pipeline, auth) are resolved, and the rest is adapter-wiring + UI against interfaces that are already built and tested.
