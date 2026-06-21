/**
 * @vaultmind/contractscan-core — ContractScan Lite domain logic (PRD Phase 3).
 * Shared result schema, tier routing, verdict rules, and on-device (Tier 1)
 * analysis. The Tier-2 cloud proxy (Gemini) lives in the backend (API key never
 * ships in the app, ADR-004).
 */

export {
  type Severity,
  type Verdict,
  type RedFlag,
  type ImportantDate,
  type DocumentSummary,
  type ContractAnalysis,
  SEVERITIES,
  VERDICTS,
  CONTRACT_ANALYSIS_SCHEMA,
  validateAnalysis,
  type ValidationResult,
} from "./schema.js";
export {
  routeAnalysis,
  TIER1_MAX_PAGES,
  type RoutingInput,
  type RoutingDecision,
  type UserTierChoice,
} from "./routing.js";
export { escalate, verdictFloorFromRedFlags, reconcileVerdict } from "./verdict.js";
export { CONTRACTSCAN_DISCLAIMER, VERDICT_LABEL, SEVERITY_LABEL } from "./disclaimer.js";
export { analyzeOnDevice, TIER1_PAGES_PER_CHUNK, type Tier1Result } from "./tier1.js";
export type { ChunkAnalysis, SlmContractAnalyzer } from "./ports.js";
