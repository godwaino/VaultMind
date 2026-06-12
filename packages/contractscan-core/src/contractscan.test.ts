import { describe, it, expect } from "vitest";
import {
  routeAnalysis,
  validateAnalysis,
  reconcileVerdict,
  verdictFloorFromRedFlags,
  analyzeOnDevice,
  CONTRACT_ANALYSIS_SCHEMA,
  CONTRACTSCAN_DISCLAIMER,
  type ContractAnalysis,
  type ChunkAnalysis,
  type SlmContractAnalyzer,
} from "./index.js";

describe("tier routing (ARCH §6.1 / DECISIONS #3)", () => {
  it("routes a short, simple doc on a capable device to Tier 1 (no egress)", () => {
    const d = routeAnalysis({ pageCount: 4, deviceCanRunSlm: true, userChoice: "local" });
    expect(d).toEqual({ tier: 1, requiresConsent: false, reason: expect.any(String) });
  });
  it("always honours an explicit cloud choice (consent-gated)", () => {
    expect(routeAnalysis({ pageCount: 2, deviceCanRunSlm: true, userChoice: "cloud" }).tier).toBe(2);
  });
  it("routes to Tier 2 when the device can't run the SLM", () => {
    const d = routeAnalysis({ pageCount: 3, deviceCanRunSlm: false, userChoice: "auto" });
    expect(d).toMatchObject({ tier: 2, requiresConsent: true });
  });
  it("routes long, multi-party, or low-confidence docs to Tier 2", () => {
    expect(routeAnalysis({ pageCount: 25, deviceCanRunSlm: true, userChoice: "auto" }).tier).toBe(2);
    expect(routeAnalysis({ pageCount: 5, deviceCanRunSlm: true, userChoice: "auto", multiParty: true }).tier).toBe(2);
    expect(routeAnalysis({ pageCount: 5, deviceCanRunSlm: true, userChoice: "auto", localConfidencePreCheck: 0.2 }).tier).toBe(2);
  });
});

describe("verdict escalation (ARCH §6.4)", () => {
  it("a serious red flag forces at least review_before_signing", () => {
    expect(verdictFloorFromRedFlags([{ original_clause_text: "x", plain_english_explanation: "y", severity: "serious" }]))
      .toBe("review_before_signing");
  });
  it("two serious red flags imply seek_legal_advice", () => {
    const flags = [
      { original_clause_text: "a", plain_english_explanation: "b", severity: "serious" as const },
      { original_clause_text: "c", plain_english_explanation: "d", severity: "serious" as const },
    ];
    expect(verdictFloorFromRedFlags(flags)).toBe("seek_legal_advice");
  });
  it("never relaxes a model verdict, only escalates", () => {
    const a: ContractAnalysis = {
      document_summary: { contract_type: "Lease", parties: ["A", "B"], plain_english_summary: "s" },
      your_obligations: [], other_party_obligations: [], important_dates: [],
      red_flags: [{ original_clause_text: "x", plain_english_explanation: "y", severity: "serious" }],
      verdict: "standard",
    };
    expect(reconcileVerdict(a).verdict).toBe("review_before_signing");
    // a higher model verdict is preserved
    expect(reconcileVerdict({ ...a, verdict: "seek_legal_advice" }).verdict).toBe("seek_legal_advice");
  });
});

describe("result schema validation", () => {
  it("rejects malformed results", () => {
    expect(validateAnalysis({}).ok).toBe(false);
    expect(validateAnalysis({ verdict: "nope" }).ok).toBe(false);
  });
  it("the JSON schema marks all six sections required", () => {
    expect(CONTRACT_ANALYSIS_SCHEMA.required).toContain("red_flags");
    expect(CONTRACT_ANALYSIS_SCHEMA.required).toHaveLength(6);
  });
});

describe("Tier 1 on-device map-reduce", () => {
  // Mock SLM: returns a red flag for the page mentioning 'penalty', parties from page 1.
  const slm: SlmContractAnalyzer = {
    async analyzeChunk(text, range) {
      const out: ChunkAnalysis = {};
      if (range.from === 1) {
        out.contract_type = "Tenancy Agreement";
        out.parties = ["Landlord (Mr A)", "Tenant (You)"];
        out.summary_fragment = "A one-year tenancy for a flat in Lekki.";
        out.your_obligations = ["Pay rent annually in advance"];
      }
      if (text.includes("penalty")) {
        out.red_flags = [{ original_clause_text: "10% penalty per day late", plain_english_explanation: "A steep late fee.", severity: "serious" }];
      }
      if (text.includes("renew")) {
        out.important_dates = [{ label: "Renewal", date_or_rule: "60 days before end", explanation: "Tell the landlord to renew." }];
      }
      return out;
    },
  };

  it("merges chunks into a schema-valid result and escalates the verdict", async () => {
    const pages = [
      "Tenancy agreement between Landlord and Tenant.",
      "Rent is payable yearly. A 10% penalty applies per day late.",
      "To renew, notify 60 days before the end.",
    ];
    const res = await analyzeOnDevice(pages, slm, 1); // 1 page per chunk -> 3 chunks
    expect(res.ok).toBe(true);
    const a = res.analysis!;
    expect(a.document_summary.contract_type).toBe("Tenancy Agreement");
    expect(a.document_summary.parties).toContain("Tenant (You)");
    expect(a.red_flags).toHaveLength(1);
    expect(a.important_dates).toHaveLength(1);
    expect(a.verdict).toBe("review_before_signing"); // escalated by the serious flag
    expect(validateAnalysis(a).ok).toBe(true);
  });

  it("produces a valid empty-ish result for an unremarkable doc", async () => {
    const res = await analyzeOnDevice(["Just a simple receipt."], slm, 3);
    expect(res.ok).toBe(true);
    expect(res.analysis!.verdict).toBe("standard");
  });
});

describe("disclaimer", () => {
  it("states it is not legal advice (REQ-CONTRACT-009)", () => {
    expect(CONTRACTSCAN_DISCLAIMER.toLowerCase()).toContain("not legal advice");
  });
});
