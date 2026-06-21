/**
 * Shared ContractScan result schema (ARCHITECTURE §6.2). BOTH tiers — on-device SLM
 * (Tier 1) and the cloud model — Gemini (Tier 2) — emit this exact shape, so the
 * results screen is identical regardless of where analysis ran (REQ-CONTRACT-006/
 * 007/008). Tier 2 uses it as the Gemini `responseSchema` (structured output); Tier
 * 1 constrains its SLM with a GBNF grammar built from the same shape. We still
 * validate at runtime.
 */

export type Severity = "note" | "caution" | "serious";
export type Verdict = "standard" | "review_before_signing" | "seek_legal_advice";

export const SEVERITIES: readonly Severity[] = ["note", "caution", "serious"];
export const VERDICTS: readonly Verdict[] = ["standard", "review_before_signing", "seek_legal_advice"];

export interface RedFlag {
  original_clause_text: string;
  plain_english_explanation: string;
  severity: Severity;
}

export interface ImportantDate {
  label: string;
  date_or_rule: string;
  explanation: string;
}

export interface DocumentSummary {
  contract_type: string;
  parties: string[];
  plain_english_summary: string;
}

export interface ContractAnalysis {
  document_summary: DocumentSummary;
  your_obligations: string[];
  other_party_obligations: string[];
  important_dates: ImportantDate[];
  red_flags: RedFlag[];
  verdict: Verdict;
}

/** JSON Schema passed to Gemini as `responseSchema` for guaranteed-valid JSON. */
export const CONTRACT_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    document_summary: {
      type: "object",
      properties: {
        contract_type: { type: "string" },
        parties: { type: "array", items: { type: "string" } },
        plain_english_summary: { type: "string" },
      },
      required: ["contract_type", "parties", "plain_english_summary"],
      additionalProperties: false,
    },
    your_obligations: { type: "array", items: { type: "string" } },
    other_party_obligations: { type: "array", items: { type: "string" } },
    important_dates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          date_or_rule: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["label", "date_or_rule", "explanation"],
        additionalProperties: false,
      },
    },
    red_flags: {
      type: "array",
      items: {
        type: "object",
        properties: {
          original_clause_text: { type: "string" },
          plain_english_explanation: { type: "string" },
          severity: { type: "string", enum: ["note", "caution", "serious"] },
        },
        required: ["original_clause_text", "plain_english_explanation", "severity"],
        additionalProperties: false,
      },
    },
    verdict: {
      type: "string",
      enum: ["standard", "review_before_signing", "seek_legal_advice"],
    },
  },
  required: [
    "document_summary",
    "your_obligations",
    "other_party_obligations",
    "important_dates",
    "red_flags",
    "verdict",
  ],
  additionalProperties: false,
} as const;

export type ValidationResult =
  | { ok: true; value: ContractAnalysis }
  | { ok: false; errors: string[] };

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((s) => typeof s === "string");
}

/** Runtime validation — defends against malformed SLM output even with a grammar. */
export function validateAnalysis(input: unknown): ValidationResult {
  const errors: string[] = [];
  const o = input as Record<string, unknown>;
  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: ["result is not an object"] };
  }

  const ds = o.document_summary as Record<string, unknown> | undefined;
  if (!ds || typeof ds.contract_type !== "string" || typeof ds.plain_english_summary !== "string" || !isStringArray(ds.parties)) {
    errors.push("document_summary is missing or malformed");
  }
  if (!isStringArray(o.your_obligations)) errors.push("your_obligations must be string[]");
  if (!isStringArray(o.other_party_obligations)) errors.push("other_party_obligations must be string[]");

  if (!Array.isArray(o.important_dates) || !o.important_dates.every((d) => {
    const r = d as Record<string, unknown>;
    return typeof r.label === "string" && typeof r.date_or_rule === "string" && typeof r.explanation === "string";
  })) {
    errors.push("important_dates malformed");
  }

  if (!Array.isArray(o.red_flags) || !o.red_flags.every((f) => {
    const r = f as Record<string, unknown>;
    return typeof r.original_clause_text === "string" &&
      typeof r.plain_english_explanation === "string" &&
      SEVERITIES.includes(r.severity as Severity);
  })) {
    errors.push("red_flags malformed");
  }

  if (!VERDICTS.includes(o.verdict as Verdict)) errors.push("verdict invalid");

  return errors.length ? { ok: false, errors } : { ok: true, value: input as ContractAnalysis };
}
