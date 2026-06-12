/**
 * POST /api/contractscan/analyze (Next.js App Router) — Tier-2 proxy (ARCH §6.3).
 *
 * Phase 3 status: the business logic in ../../../../lib/contractscan/analyze.ts is
 * complete and tested. The adapters below are placeholders; wiring is:
 *  - ClaudeClient   -> @anthropic-ai/sdk, model from config (claude-sonnet-4-6),
 *                      output_config = CONTRACT_ANALYSIS_SCHEMA, prompt-cached system
 *                      prompt, SSE streaming, in-memory only.  ZDR/retention: see
 *                      docs/DECISIONS.md #7 before shipping the absolute-deletion copy.
 *  - EntitlementStore / UsageCounter / AuditLog -> Supabase (service role).
 * JWT verification + the Tier-2 consent token are checked at the edge before this.
 */

import { handleAnalyze, type AnalyzeRequest } from "../../../../lib/contractscan/analyze.js";
import type {
  AuditLog,
  ClaudeClient,
  EntitlementStore,
  UsageCounter,
} from "../../../../lib/contractscan/ports.js";

const claude: ClaudeClient = {
  async analyzeContract() {
    throw new Error("ClaudeClient not configured (Phase 3 placeholder)");
  },
};
const entitlements: EntitlementStore = {
  async getTier() {
    throw new Error("EntitlementStore not configured (Phase 3 placeholder)");
  },
};
const usage: UsageCounter = {
  async get() {
    throw new Error("UsageCounter not configured (Phase 3 placeholder)");
  },
  async increment() {},
};
const audit: AuditLog = { async record() {} };

export async function POST(request: Request): Promise<Response> {
  let body: AnalyzeRequest;
  try {
    body = (await request.json()) as AnalyzeRequest;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const result = await handleAnalyze(body, { claude, entitlements, usage, audit, now: () => new Date() });
  return Response.json(result.body, { status: result.status });
}
