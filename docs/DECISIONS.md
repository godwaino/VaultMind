# VaultMind — Decisions & Open-Question Resolutions

**Companion to:** `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_PLAN.md`, `VaultMind_PRD_v1.0.docx`
**Purpose:** Records the founder decisions taken in response to the architecture/idea review (PR #1). Each entry is the authoritative resolution; `ARCHITECTURE.md` §11 (Open Questions) now points here.
**Status:** Resolved unless marked otherwise.

---

## Summary table

| # | Issue | Decision | Where applied |
|---|---|---|---|
| 1 | Free tier doesn't survive device loss (core promise only true for paying users) | **Add optional, opt-in encrypted cloud backup to the free tier, up to 5 GB.** Local-first remains the default and the privacy answer for businesses, who can decline backup entirely. | ARCH §3.2, §4.2, §7; PLAN Phase 1/4; ADR-010 |
| 2 | Zero-knowledge backup = forgotten password loses the backup | **Ship a recovery-phrase option in MVP** (not deferred to Phase 2). Keep it as simple and customer-centric as possible. | ARCH §3.2, §5, ADR-007; PLAN Phase 0/4 |
| 3 | On-device 3B LLM doesn't fit 2–4 GB-RAM market devices | **Split by model class: local = SLM, cloud = LLM, and the subscriber chooses.** On-device analysis runs a small language model sized for low-RAM phones; the cloud tier runs a full LLM (Gemini). The cloud option is part of the free tier (see #1's cloud path). | ARCH §3.5, §6.1, §6.4, ADR-011; PLAN Phase 0/3 |
| 4 | Document management is low-frequency; 40% D30 retention is steep | **Trigger early/synthetic reminders during validation** so testers experience the value without waiting ~89 days, and **measure value as "documents under management" and "reminders that fired and were acted on," not raw app-opens.** | ARCH §4.3; PLAN Phase 2, success-metric map |
| 5 | Landing-page test asks ₦2,000 but launch is ₦3,500 | **Run the pricing validation at the real price** (early-access ₦1,500 and/or standard ₦3,500), not ₦2,000. | PLAN Week −2 to 0 |
| 6 | Compliance aimed at the superseded NDPR 2019 | **Re-point all compliance to the Nigeria Data Protection Act (NDPA) 2023** with the NDPC as regulator. (Already corrected in ARCH §8/ADR-009 — confirmed.) | ARCH §8, ADR-009; PLAN Phase 0 |
| 7 | "Permanently deleted, never stored" isn't ours to promise once data hits Gemini/Google Vision | **Adopt the global-best-practice posture below.** Do not make an absolute deletion claim that depends on a third party unless zero-data-retention (ZDR) is in place; otherwise disclose the sub-processor and its real retention. | ARCH §6.3, §8; this doc |
| 8 | Scope vs. one developer in 16 weeks | **Adjust the schedule as needed; documentation only at this stage.** Descoping lever stays: if the week-1 device test fails, ship cloud-only (LLM) ContractScan for MVP. | PLAN (cross-cutting) |
| Nit A | NIN is permanent; PVC doesn't expire | Removed from expiry tracking; remain as vault categories. (Already applied.) | ARCH §4.3; PLAN Phase 2 |
| Nit B | Family tier priced but Family Profiles are out of MVP scope | **Sell Personal only at launch; waitlist Family.** Don't build entitlements for an unbuilt feature. | PLAN Phase 4 |

---

## Detail notes

### #1 — Free-tier backup (5 GB, opt-in)

The product promise ("never lose documents at critical moments") cannot be true only for paying users, or the first lost-phone story becomes a reputational event. Resolution: the free tier gets **optional, opt-in, client-side-encrypted cloud backup up to 5 GB**. Privacy-sensitive users (the businesses the local-first design targets) simply leave it off and keep everything on-device — local-first stays the default and the differentiator.

Implications to keep honest:
- It is still **opt-in** and still **zero-knowledge** (client-side encrypted; see #2 for recovery). A free user who declines backup and loses their phone still loses their vault — message this plainly at the device-loss touchpoints.
- 5 GB comfortably covers the 50-document free cap. Watch storage cost per free user; the cap and dormant-account cleanup keep it bounded.

### #2 — Recovery phrase in MVP

Zero-knowledge means the server cannot reset a backup password. For a persona prone to forgetting things, "lost phone AND lost backup" is unacceptable, so recovery moves into MVP rather than Phase 2.

Recommended, customer-centric design:
- On enabling backup, generate a **recovery phrase** (BIP39-style word list) that can re-derive the backup key independently of the password. Show it once, require the user to confirm a few words, and explain in one line what it's for.
- Offer a simpler fallback for non-technical users: a **"recovery kit"** — the same key material wrapped and saved as an encrypted file the user emails to themselves or stores in their own cloud. Either path restores backups after a password reset; neither gives the server a decryption key, so zero-knowledge holds.

### #3 — SLM local, LLM cloud, user chooses

Local on-device analysis (ContractScan Tier 1, plus metadata/categorisation) runs a **small language model** chosen to fit 2–4 GB-RAM devices, not the ~2 GB-RAM 3B model. The **cloud tier runs a full LLM (Gemini, paid API / Vertex AI)** for deeper analysis. The subscriber decides local vs. cloud: privacy-maximising users stay on the SLM; users who want depth (and consent to egress) use the cloud LLM, which is available on the free tier per #1's cloud path. If a device can't even run the SLM, it routes to the cloud LLM with consent. This keeps "your data never leaves your device" true for the users who choose it, instead of silently failing on low-end hardware.

Model selection is a config value to be fixed by the week-1 device test (see #8): a 1B-class SLM (e.g. Llama 3.2 1B) is the starting candidate; a sub-1B SLM is the fallback if RAM headroom is tight.

### #4 — Retention measured as value delivered, not app-opens

A good reminder utility is silent for 89 days, so raw D30 retention understates value. During validation we **fire early/synthetic reminders** so testers actually experience an alert, and we judge success on **documents under management** and **reminders that fired and were acted upon**. Raw retention stays a secondary, context-only number.

### #5 — Validate the real price

Stated willingness-to-pay overstates real conversion, so at minimum test the price you'll actually charge. The landing-page gate asks at **early-access ₦1,500 and/or standard ₦3,500**, not ₦2,000. Treat survey "yes" as a soft signal; the binding signal is early-access pre-commitment.

### #6 — NDPA 2023

All consent, records-of-processing, breach-notification, and DPO/registration work targets the **NDPA 2023 / NDPC**, not the NDPR 2019. Confirmed already reflected in ARCH §8 and ADR-009.

### #7 — The "permanently deleted, never stored" claim — global best practice

The claim is fine for *our* servers (the Tier-2 proxy holds contract bytes in memory only and persists nothing). It is **not ours to make for Google (Gemini) or Google Vision**, whose retention is governed by their terms. Under the NDPA this consent copy is a regulated representation, not just marketing, so it must be accurate.

> **Provider note:** Tier-2 analysis uses **Google Gemini** (paid API / Vertex AI), not Anthropic. This is actually a cleaner retention story — see below. Use the **paid** Gemini API or Vertex AI; the **free Google AI Studio tier trains on submitted data** and must not be used.

Best-practice posture (in order of preference):

1. **Get zero-data-retention (ZDR) before relying on the absolute claim.** On the **paid** Gemini API / Vertex AI, Google contractually does **not train** on your prompts, files, or responses; by default it logs them for a limited period solely for abuse monitoring. **ZDR is available by request, per project** — once approved, content and identifiable metadata (IP, account IDs) are dropped *before* logging. Unlike some providers there is **no model-family carve-out**, so model choice isn't constrained by ZDR eligibility. ZDR caveats that must be honoured: **no Google Search/Maps grounding** (forces unavoidable 30-day storage), **no explicit context caching**, and **no File API persistence** — none of which ContractScan needs. Do the equivalent for OCR (Vision retention/region controls, or a no-retention OCR path).
2. **If ZDR isn't yet approved, don't claim absolute deletion.** Replace the consent copy with an accurate version: name the sub-processor (Google), state that content is sent for analysis, retained only transiently for abuse monitoring, and **not used for training on the paid tier**, and link Google's policy. Accurate disclosure beats an unprovable absolute.
3. **Always:** stay on the paid tier (training-excluded), maintain a sub-processor list in the privacy notice (Google for Gemini + Vision), sign the Google Cloud DPA / sub-processor terms, log the consent event, and make egress consent-gated and per-document (already in the architecture).

Recommendation: request per-project Gemini **ZDR** (and a no-retention OCR path) as a Phase-3 blocking item; in the meantime ship the *accurate-disclosure* copy rather than the absolute one. Wording owner: founder; due Phase 3 exit.

_Sources (provider retention, verified June 2026):_ Google "Zero data retention in the Gemini Developer API" (https://ai.google.dev/gemini-api/docs/zdr); Gemini API Terms — Paid Services training restriction.

### #8 — Schedule

Documentation-stage only; the 16-week plan is indicative. The single biggest schedule de-risk remains: if the **week-1 device test** shows the SLM can't deliver acceptable on-device analysis, ship **cloud-LLM-only ContractScan** for MVP and drop the on-device analysis line item — it still validates all three hypotheses.

### Nits

- **A:** NIN (permanent) and PVC (non-expiring) removed from expiry *tracking*; still vault categories. The supported-document list should get a pass from someone who handles these daily.
- **B:** Launch sells **Personal only**; Family is waitlisted. Remove Family from launch billing/entitlements to avoid selling an unbuilt feature.

---

## Web companion (scope addition, ADR-012)

VaultMind is now **mobile + web**. Decision: the web app is a **companion** (account, billing, settings, document viewing/management, ExpiryGuard, cloud ContractScan), **not** a full replacement, and it keeps the **same zero-knowledge model** with **cloud (Gemini) AI** — no on-device SLM in the browser. Rationale and the full reuse/adapter map are in `docs/WEB_COMPANION.md`. Two trade-offs accepted and to be messaged honestly: (a) browser key storage (non-extractable WebCrypto keys in IndexedDB) is weaker than mobile's hardware-backed Keychain, so mobile remains the privacy-maximum surface; (b) contract analysis on web is cloud-only (consent-gated), reusing the same `contractscan-core` schema/routing with `deviceCanRunSlm: false`. Enabler shipped: `@vaultmind/search` is now driver-injected so it runs on wa-sqlite in the browser as well as node:sqlite/expo-sqlite.

## Still genuinely open (carried forward)

- **SMS OTP provider** for Nigerian numbers (Termii vs Twilio) — decide Phase 0, week 1 (cost/deliverability).
- **Exact SLM** for on-device analysis — fixed by the week-1 device test (#3/#8).
- **ZDR / no-retention OCR contracts** — in progress per #7; blocks the absolute-deletion copy only.

_Sources for the retention facts in #7 (Gemini, verified June 2026):_
- Google — Zero data retention in the Gemini Developer API: https://ai.google.dev/gemini-api/docs/zdr
- Gemini API Terms of Service — Paid Services (no training on prompts/responses): https://ai.google.dev/gemini-api/terms
