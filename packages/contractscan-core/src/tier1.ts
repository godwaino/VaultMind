/**
 * Tier 1 — on-device contract analysis (ARCHITECTURE §6.4). Map-reduce over page
 * chunks with the SLM: per-chunk extraction → merge → verdict. The verdict can only
 * be escalated by the merge (never relaxed). Output is the SAME schema as Tier 2.
 */

import { reconcileVerdict } from "./verdict.js";
import { validateAnalysis, type ContractAnalysis, type ImportantDate, type RedFlag } from "./schema.js";
import type { ChunkAnalysis, SlmContractAnalyzer } from "./ports.js";

export const TIER1_PAGES_PER_CHUNK = 3;

function uniqStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of items) {
    const key = s.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(s.trim());
    }
  }
  return out;
}

function mostCommon(values: string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const v of values) {
    const k = v.trim();
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestN = 0;
  for (const [k, n] of counts) if (n > bestN) {
    best = k;
    bestN = n;
  }
  return best;
}

function chunkPages(pages: string[], size: number): { text: string; from: number; to: number }[] {
  const chunks: { text: string; from: number; to: number }[] = [];
  for (let i = 0; i < pages.length; i += size) {
    const slice = pages.slice(i, i + size);
    chunks.push({ text: slice.join("\n\n"), from: i + 1, to: Math.min(i + size, pages.length) });
  }
  return chunks;
}

export interface Tier1Result {
  ok: boolean;
  analysis?: ContractAnalysis;
  errors?: string[];
  tier: 1;
}

export async function analyzeOnDevice(
  pages: string[],
  slm: SlmContractAnalyzer,
  pagesPerChunk = TIER1_PAGES_PER_CHUNK
): Promise<Tier1Result> {
  const chunks = chunkPages(pages, pagesPerChunk);
  const results: ChunkAnalysis[] = [];
  for (const c of chunks) {
    results.push(await slm.analyzeChunk(c.text, { from: c.from, to: c.to }));
  }

  const yourObligations: string[] = [];
  const otherObligations: string[] = [];
  const importantDates: ImportantDate[] = [];
  const redFlags: RedFlag[] = [];
  const parties: string[] = [];
  const types: string[] = [];
  const summaryFragments: string[] = [];

  for (const r of results) {
    if (r.your_obligations) yourObligations.push(...r.your_obligations);
    if (r.other_party_obligations) otherObligations.push(...r.other_party_obligations);
    if (r.important_dates) importantDates.push(...r.important_dates);
    if (r.red_flags) redFlags.push(...r.red_flags);
    if (r.parties) parties.push(...r.parties);
    if (r.contract_type) types.push(r.contract_type);
    if (r.summary_fragment) summaryFragments.push(r.summary_fragment);
  }

  const merged: ContractAnalysis = {
    document_summary: {
      contract_type: mostCommon(types) ?? "Unknown",
      parties: uniqStrings(parties),
      plain_english_summary: uniqStrings(summaryFragments).join(" ") || "No summary could be produced on-device.",
    },
    your_obligations: uniqStrings(yourObligations),
    other_party_obligations: uniqStrings(otherObligations),
    important_dates: importantDates,
    red_flags: redFlags,
    verdict: "standard",
  };

  const reconciled = reconcileVerdict(merged);
  const valid = validateAnalysis(reconciled);
  if (!valid.ok) return { ok: false, errors: valid.errors, tier: 1 };
  return { ok: true, analysis: valid.value, tier: 1 };
}
