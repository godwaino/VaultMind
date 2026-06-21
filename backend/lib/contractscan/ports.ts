/**
 * Ports for the Tier-2 ContractScan proxy. The real adapter wraps the Google GenAI
 * SDK (@google/genai) with the Gemini API key from Vercel env (never in the app,
 * ADR-004), uses structured output (responseSchema = CONTRACT_ANALYSIS_SCHEMA,
 * responseMimeType "application/json"), and holds the document in memory only
 * (ARCHITECTURE §6.3). The interface is provider-neutral, so the cloud model can be
 * swapped without touching the analysis logic.
 */

export interface CloudContractInput {
  mimeType: string;
  /** base64 PDF or image; held in memory only, never persisted/logged */
  base64: string;
  /** the party the analysis is written for */
  signingParty: string;
}

export interface CloudContractAnalyzer {
  /** returns the raw JSON object the model produced (validated by the caller) */
  analyzeContract(input: CloudContractInput): Promise<unknown>;
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
