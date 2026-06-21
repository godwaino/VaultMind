/**
 * Ports for ContractScan. Tier 1 runs entirely on-device behind `SlmContractAnalyzer`
 * (llama.rn + a GBNF grammar, DECISIONS #3). Tier 2's cloud client (Gemini) lives
 * in the backend, not here, because the API key must never ship in the app (ADR-004).
 */

import type { ImportantDate, RedFlag } from "./schema.js";

/** Per-chunk output from the on-device SLM during the map step. All fields optional. */
export interface ChunkAnalysis {
  contract_type?: string;
  parties?: string[];
  summary_fragment?: string;
  your_obligations?: string[];
  other_party_obligations?: string[];
  important_dates?: ImportantDate[];
  red_flags?: RedFlag[];
}

export interface SlmContractAnalyzer {
  /** Analyse one chunk of contract text (a few pages). GBNF-constrained on device. */
  analyzeChunk(text: string, pageRange: { from: number; to: number }): Promise<ChunkAnalysis>;
}
