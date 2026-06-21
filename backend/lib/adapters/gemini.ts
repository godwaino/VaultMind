/**
 * Real Gemini Tier-2 adapter (ARCHITECTURE §6.3, DECISIONS #3/#7). Implements the
 * provider-neutral CloudContractAnalyzer port using the Google GenAI SDK. Use the
 * PAID Gemini API or Vertex AI (the free AI Studio tier trains on data). Holds the
 * document in memory only; persists nothing.
 */

import { GoogleGenAI } from "@google/genai";
import { CONTRACT_ANALYSIS_SCHEMA } from "@vaultmind/contractscan-core";
import type { CloudContractAnalyzer, CloudContractInput } from "../contractscan/ports.js";

const SYSTEM_PROMPT = [
  "You are ContractScan, a careful assistant that explains contracts in plain English",
  "for everyday people in Nigeria. You are not a lawyer and must not give legal advice.",
  "Read the document and produce ONLY the structured JSON the schema requires:",
  "a plain-English summary, the named party's obligations and the other party's,",
  "important dates/rules, and red flags (severity note|caution|serious) quoting the",
  "exact clause text. Choose a verdict: standard, review_before_signing, or",
  "seek_legal_advice. Never invent clauses; if unsure, say so in plain language.",
].join(" ");

/**
 * Gemini's responseSchema is an OpenAPI-3 subset: UPPERCASE `Type` values and no
 * `additionalProperties`. Convert our canonical JSON Schema (§6.2) to that shape so
 * one schema definition drives both tiers.
 */
function toGeminiSchema(node: unknown): Record<string, unknown> {
  const s = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (typeof s.type === "string") out.type = s.type.toUpperCase();
  if (s.enum) out.enum = s.enum;
  if (s.description) out.description = s.description;
  if (s.items) out.items = toGeminiSchema(s.items);
  if (s.properties) {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s.properties as Record<string, unknown>)) {
      props[k] = toGeminiSchema(v);
    }
    out.properties = props;
  }
  if (Array.isArray(s.required)) out.required = s.required;
  // intentionally drop additionalProperties — unsupported by Gemini responseSchema
  return out;
}

const GEMINI_RESPONSE_SCHEMA = toGeminiSchema(CONTRACT_ANALYSIS_SCHEMA);

export interface GeminiOptions {
  apiKey: string;
  model?: string;
}

export function makeGeminiAnalyzer(opts: GeminiOptions): CloudContractAnalyzer {
  const ai = new GoogleGenAI({ apiKey: opts.apiKey });
  const model = opts.model ?? "gemini-2.5-pro";

  return {
    async analyzeContract(input: CloudContractInput): Promise<unknown> {
      const res = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: input.mimeType, data: input.base64 } },
              { text: `Analyse this contract written for the party: "${input.signingParty}".` },
            ],
          },
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: GEMINI_RESPONSE_SCHEMA,
          // No Google Search/Maps grounding, no explicit caching — keeps ZDR posture (DECISIONS #7).
        },
      });

      const text = res.text;
      if (!text) throw new Error("Gemini returned no text (possibly blocked or truncated)");
      try {
        return JSON.parse(text);
      } catch {
        throw new Error("Gemini returned non-JSON output");
      }
    },
  };
}
