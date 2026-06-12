/**
 * Verdict logic (ARCHITECTURE §6.4). The verdict can only be ESCALATED by evidence,
 * never relaxed: any `serious` red flag forces at least `review_before_signing`.
 * This is applied in the Tier-1 merge step and re-asserted on any analysis result,
 * so a model can't return "standard" alongside a serious red flag.
 */

import type { ContractAnalysis, RedFlag, Verdict } from "./schema.js";

const RANK: Record<Verdict, number> = {
  standard: 0,
  review_before_signing: 1,
  seek_legal_advice: 2,
};

export function escalate(a: Verdict, b: Verdict): Verdict {
  return RANK[a] >= RANK[b] ? a : b;
}

/** Minimum defensible verdict implied by the red flags present. */
export function verdictFloorFromRedFlags(redFlags: RedFlag[]): Verdict {
  const seriousCount = redFlags.filter((f) => f.severity === "serious").length;
  const cautionCount = redFlags.filter((f) => f.severity === "caution").length;
  if (seriousCount >= 2) return "seek_legal_advice";
  if (seriousCount >= 1) return "review_before_signing";
  if (cautionCount >= 3) return "review_before_signing";
  return "standard";
}

/** Reconcile a model-provided verdict with the floor implied by its red flags. */
export function reconcileVerdict(analysis: ContractAnalysis): ContractAnalysis {
  const floor = verdictFloorFromRedFlags(analysis.red_flags);
  return { ...analysis, verdict: escalate(analysis.verdict, floor) };
}
