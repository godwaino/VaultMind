/**
 * Ports for the Tier-2 ContractScan proxy. The real ClaudeClient wraps the official
 * @anthropic-ai/sdk with the Anthropic key from Vercel env (never in the app,
 * ADR-004), uses structured outputs against CONTRACT_ANALYSIS_SCHEMA, prompt-cached
 * system prompt, and holds the document in memory only (ARCHITECTURE §6.3).
 */

export interface ClaudeContractInput {
  mimeType: string;
  /** base64 PDF or image; held in memory only, never persisted/logged */
  base64: string;
  /** the party the analysis is written for */
  signingParty: string;
}

export interface ClaudeClient {
  /** returns the raw JSON object Claude produced (validated by the caller) */
  analyzeContract(input: ClaudeContractInput): Promise<unknown>;
}

export type Tier = "free" | "personal" | "family";

export interface EntitlementStore {
  getTier(userId: string): Promise<Tier>;
}

export interface UsageCounter {
  /** current count for a metric in a period (e.g. month bucket) */
  get(userId: string, metric: string, period: string): Promise<number>;
  increment(userId: string, metric: string, period: string): Promise<void>;
}

export interface AuditLog {
  /** content-free security/usage event */
  record(event: { userId: string; event: string; at: string }): Promise<void>;
}
