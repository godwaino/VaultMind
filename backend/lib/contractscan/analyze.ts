/**
 * Tier-2 ContractScan analysis — server-side proxy logic (ARCHITECTURE §6.3,
 * REQ-CONTRACT-005/012). Framework-agnostic and fully unit-tested; the Next route
 * is a thin wrapper. Enforces, in order: Tier-2 consent → entitlement/quota →
 * cloud-model call → schema validation + verdict reconciliation. Nothing about the
 * document is persisted or logged; only a usage increment and a content-free audit.
 * The cloud model (Gemini) sits behind the provider-neutral CloudContractAnalyzer port.
 */

import { validateAnalysis, reconcileVerdict, type ContractAnalysis } from "@vaultmind/contractscan-core";
import type { AuditLog, CloudContractAnalyzer, EntitlementStore, UsageCounter } from "./ports.js";

/** Free tier: 2 cloud analyses per calendar month (REQ-CONTRACT-012). */
export const FREE_TIER_MONTHLY_ANALYSES = 2;
const METRIC = "contractscan_analyses";

export interface AnalyzeRequest {
  userId: string;
  /** the client sets this only after passing the non-dismissable consent gate */
  tier2ConsentGranted: boolean;
  mimeType: string;
  base64: string;
  signingParty: string;
}

export interface UsageInfo {
  used: number;
  limit: number | null; // null = unlimited (paid)
  remaining: number | null;
}

export type AnalyzeResponse =
  | { status: 200; body: { analysis: ContractAnalysis; tier: 2; usage: UsageInfo } }
  | { status: 400; body: { error: string } }
  | { status: 403; body: { error: "consent_required" } }
  | { status: 402; body: { error: "quota_exceeded"; usage: UsageInfo } }
  | { status: 502; body: { error: "analysis_failed"; details: string[] } };

export interface AnalyzeDeps {
  entitlements: EntitlementStore;
  usage: UsageCounter;
  analyzer: CloudContractAnalyzer;
  audit: AuditLog;
  now: () => Date;
}

function monthBucket(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function handleAnalyze(req: AnalyzeRequest, deps: AnalyzeDeps): Promise<AnalyzeResponse> {
  if (!req.base64 || !req.mimeType) {
    return { status: 400, body: { error: "document is required" } };
  }
  // 1) consent gate (re-checked server-side, not just UI)
  if (!req.tier2ConsentGranted) {
    return { status: 403, body: { error: "consent_required" } };
  }

  // 2) entitlement + quota
  const tier = await deps.entitlements.getTier(req.userId);
  const period = monthBucket(deps.now());
  const used = await deps.usage.get(req.userId, METRIC, period);
  const limit = tier === "free" ? FREE_TIER_MONTHLY_ANALYSES : null;

  if (limit !== null && used >= limit) {
    return {
      status: 402,
      body: { error: "quota_exceeded", usage: { used, limit, remaining: 0 } },
    };
  }

  // 3) call the cloud model (document held in memory only)
  const raw = await deps.analyzer.analyzeContract({
    mimeType: req.mimeType,
    base64: req.base64,
    signingParty: req.signingParty,
  });

  // 4) validate + reconcile verdict (defence in depth even with structured outputs)
  const valid = validateAnalysis(raw);
  if (!valid.ok) {
    return { status: 502, body: { error: "analysis_failed", details: valid.errors } };
  }
  const analysis = reconcileVerdict(valid.value);

  // 5) meter + content-free audit (no document content anywhere)
  await deps.usage.increment(req.userId, METRIC, period);
  await deps.audit.record({ userId: req.userId, event: "contractscan_tier2", at: deps.now().toISOString() });

  const newUsed = used + 1;
  const usage: UsageInfo =
    limit === null
      ? { used: newUsed, limit: null, remaining: null }
      : { used: newUsed, limit, remaining: Math.max(0, limit - newUsed) };

  return { status: 200, body: { analysis, tier: 2, usage } };
}
