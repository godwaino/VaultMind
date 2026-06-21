/**
 * POST /api/contractscan/analyze (Next.js App Router) — Tier-2 proxy (ARCH §6.3).
 * Returns 501 until Gemini + Supabase are configured; otherwise uses the real
 * adapters. Document held in memory only; nothing persisted but a usage increment
 * and a content-free audit. JWT + Tier-2 consent are verified at the edge / in body.
 */

import { handleAnalyze, type AnalyzeRequest } from "../../../../lib/contractscan/analyze.js";
import { missingEnv, notConfigured } from "../../../../lib/http.js";
import {
  makeAuditLog,
  makeEntitlementStore,
  makeUsageCounter,
  supabaseAdmin,
} from "../../../../lib/adapters/supabase.js";
import { makeGeminiAnalyzer } from "../../../../lib/adapters/gemini.js";

const REQUIRED_ENV = ["GEMINI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

export async function POST(request: Request): Promise<Response> {
  const missing = missingEnv(REQUIRED_ENV);
  if (missing.length) return notConfigured(`ContractScan Tier-2 is not configured (missing ${missing.join(", ")}).`);

  let body: AnalyzeRequest;
  try {
    body = (await request.json()) as AnalyzeRequest;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const analyzer = makeGeminiAnalyzer({
    apiKey: process.env.GEMINI_API_KEY as string,
    ...(process.env.GEMINI_MODEL ? { model: process.env.GEMINI_MODEL } : {}),
  });

  const result = await handleAnalyze(body, {
    analyzer,
    entitlements: makeEntitlementStore(sb),
    usage: makeUsageCounter(sb),
    audit: makeAuditLog(sb),
    now: () => new Date(),
  });
  return Response.json(result.body, { status: result.status });
}
