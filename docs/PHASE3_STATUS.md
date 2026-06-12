# Phase 3 — ContractScan Lite: Status

**Branch:** `claude/phase-0-foundations` (continues from Phases 0–2)
**Plan reference:** `docs/IMPLEMENTATION_PLAN.md` → Phase 3 (Weeks 11–14).
**Exit criteria (PRD):** upload a tenancy agreement, receive a plain-English breakdown with red flags.

Same pattern: domain logic **built and tested**; the on-device SLM and the cloud Claude client are **injected via ports**; the results UI is left as Expo work.

## What runs and is tested now (Node/TypeScript)

| Capability | Where | Maps to |
|---|---|---|
| Shared result schema (both tiers) + runtime validator + JSON Schema for Claude | `contractscan-core/schema.ts` | REQ-CONTRACT-006, §6.2 |
| Tier routing: SLM-local vs cloud-LLM, consent-gated, user choice wins | `contractscan-core/routing.ts` | §6.1, DECISIONS #3 |
| Verdict escalation (serious flag ⇒ at least review; escalate-only) | `contractscan-core/verdict.ts` | §6.4 |
| Tier 1 on-device map-reduce analysis behind an SLM port | `contractscan-core/tier1.ts` | REQ-CONTRACT-004, §6.4 |
| Legal disclaimer + verdict/severity labels | `contractscan-core/disclaimer.ts` | REQ-CONTRACT-009 |
| Tier 2 proxy logic: consent → entitlement/quota → Claude → validate → meter | `backend/lib/contractscan/analyze.ts` | §6.3, REQ-CONTRACT-005/012 |
| Free-tier 2/month usage counter; paid = unlimited | `backend/lib/contractscan/analyze.ts` | REQ-CONTRACT-012/014 |

**Test counts:** 107 total across the monorepo; ContractScan adds 18 (12 core + 6 backend).

```bash
npm test          # 107 tests
npm run typecheck
```

### Design points worth re-reading
- **One schema, two engines.** Tier 1 (on-device SLM) and Tier 2 (cloud Claude) emit the **identical** `ContractAnalysis` shape, so the results screen is engine-agnostic. Tier 2 passes it to Claude as `output_config` for guaranteed-valid JSON; Tier 1 constrains its SLM with a GBNF grammar built from the same shape. Both are re-validated at runtime.
- **Verdict can only escalate.** `reconcileVerdict` raises a model's verdict to the floor implied by its red flags (a `serious` flag ⇒ at least `review_before_signing`) and never lowers it — applied in the Tier-1 merge and again on the Tier-2 result, so "standard" can't sit next to a serious flag.
- **Consent + quota are server-side.** The Tier-2 handler returns 403 without Tier-2 consent and 402 past the free 2/month quota — re-checked on the server, not just the UI, and Claude isn't called once the quota is hit. The document is held in memory only; nothing about it is persisted or logged (just a usage increment + a content-free audit).

## Interfaces + stubs (need device / live services)

- **`SlmContractAnalyzer`** (Tier 1) — device adapter = the SLM via `llama.rn` with a GBNF grammar (DECISIONS #3). Tests use a deterministic mock. The ≥20-contract eval set (PLAN week 12) is the real quality gate for both tiers.
- **`ClaudeClient`** (Tier 2) — `backend/app/api/contractscan/analyze/route.ts` is the real route shell; the adapter wraps `@anthropic-ai/sdk` (model `claude-sonnet-4-6` from config, `output_config` = `CONTRACT_ANALYSIS_SCHEMA`, prompt-cached system prompt, SSE streaming, in-memory only). **Blocking pre-launch:** the ZDR / retention decision in `docs/DECISIONS.md` #7 governs the consent-screen wording.
- **`EntitlementStore` / `UsageCounter` / `AuditLog`** — Supabase (service role) on the server.
- **Results UI** — the structured scrollable screen (clause-beside-explanation), the non-dismissable disclaimer, re-run, and the free-tier counter display are Expo work.
- **Result persistence** — analysis is saved encrypted next to the source document via the Phase-1 vault store (REQ-CONTRACT-010); the analysis object produced here is what gets stored.

## Phase 3 exit checklist (PRD)

- [x] Shared result schema + validation
- [x] Tier routing (SLM-local / cloud-LLM, consent-gated)
- [x] Tier 1 on-device analysis (logic; SLM mocked)
- [x] Tier 2 proxy: consent + entitlement + 2/month quota + validation + metering (logic; Claude mocked)
- [x] Verdict escalation + legal disclaimer
- [ ] SLM + Claude adapters wired; ≥20-contract eval set meets the recall bar
- [ ] Anthropic ZDR/retention arrangement (or accurate-disclosure copy) — DECISIONS #7
- [ ] Results UI, re-run, disclaimer rendering, usage display
- [ ] Tier-2 SSE streaming + ≤60s latency validation on device

"Upload a contract → plain-English breakdown with red flags" is logic-complete and tested end-to-end with mocked engines; the unchecked items are the model adapters, the eval set, the retention arrangement, and the UI.
