import { describe, it, expect } from "vitest";
import { handleAnalyze, FREE_TIER_MONTHLY_ANALYSES, type AnalyzeDeps } from "./analyze.js";
import type { CloudContractAnalyzer, EntitlementStore, UsageCounter, AuditLog, Tier } from "./ports.js";
import type { ContractAnalysis } from "@vaultmind/contractscan-core";

const goodResult: ContractAnalysis = {
  document_summary: { contract_type: "Tenancy", parties: ["Landlord", "You"], plain_english_summary: "A lease." },
  your_obligations: ["Pay rent"],
  other_party_obligations: ["Maintain the property"],
  important_dates: [],
  red_flags: [{ original_clause_text: "10% daily penalty", plain_english_explanation: "steep", severity: "serious" }],
  verdict: "standard", // deliberately understated -> should be escalated
};

function makeDeps(opts: { tier?: Tier; used?: number; modelReturns?: unknown } = {}): AnalyzeDeps & {
  counters: Map<string, number>;
  audits: { count: number };
} {
  const counters = new Map<string, number>();
  if (opts.used) counters.set("contractscan_analyses", opts.used);
  const audits = { count: 0 };
  const entitlements: EntitlementStore = { async getTier() { return opts.tier ?? "free"; } };
  const usage: UsageCounter = {
    async get(_u, metric) { return counters.get(metric) ?? 0; },
    async increment(_u, metric) { counters.set(metric, (counters.get(metric) ?? 0) + 1); },
  };
  const analyzer: CloudContractAnalyzer = {
    async analyzeContract() { return opts.modelReturns ?? goodResult; },
  };
  const audit: AuditLog = { async record() { audits.count++; } };
  const deps = { entitlements, usage, analyzer, audit, now: () => new Date("2026-06-15T00:00:00Z") };
  return Object.assign(deps, { counters, audits });
}

const base = {
  userId: "u1", tier2ConsentGranted: true, mimeType: "application/pdf",
  base64: "JVBERi0=", signingParty: "You",
};

describe("Tier-2 analyze handler", () => {
  it("blocks without Tier-2 consent (403) — server-side, not just UI", async () => {
    const res = await handleAnalyze({ ...base, tier2ConsentGranted: false }, makeDeps());
    expect(res.status).toBe(403);
  });

  it("analyses, escalates the verdict, meters usage, and audits content-free", async () => {
    const deps = makeDeps({ tier: "free", used: 0 });
    const res = await handleAnalyze(base, deps);
    expect(res.status).toBe(200);
    if (res.status === 200) {
      expect(res.body.analysis.verdict).toBe("review_before_signing"); // escalated
      expect(res.body.usage).toEqual({ used: 1, limit: 2, remaining: 1 });
    }
    expect(deps.counters.get("contractscan_analyses")).toBe(1);
    expect(deps.audits.count).toBe(1);
  });

  it("enforces the free-tier 2/month quota (402) and does not call the model past it", async () => {
    const deps = makeDeps({ tier: "free", used: FREE_TIER_MONTHLY_ANALYSES });
    const res = await handleAnalyze(base, deps);
    expect(res.status).toBe(402);
    if (res.status === 402) expect(res.body.usage.remaining).toBe(0);
    // counter not incremented
    expect(deps.counters.get("contractscan_analyses")).toBe(FREE_TIER_MONTHLY_ANALYSES);
  });

  it("paid tiers are unlimited (null limit/remaining)", async () => {
    const res = await handleAnalyze(base, makeDeps({ tier: "personal", used: 99 }));
    expect(res.status).toBe(200);
    if (res.status === 200) expect(res.body.usage).toMatchObject({ limit: null, remaining: null });
  });

  it("returns 502 when the cloud model yields a malformed result", async () => {
    const res = await handleAnalyze(base, makeDeps({ modelReturns: { verdict: "nonsense" } }));
    expect(res.status).toBe(502);
  });

  it("requires a document (400)", async () => {
    const res = await handleAnalyze({ ...base, base64: "" }, makeDeps());
    expect(res.status).toBe(400);
  });
});
