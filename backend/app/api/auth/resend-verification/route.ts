/**
 * POST /api/auth/resend-verification (Next.js App Router) — REQ-AUTH-001..003.
 * Unblocks accounts stuck unconfirmed because the original signup email never
 * arrived. Returns 501 until Supabase is configured, matching /api/auth/register.
 */

import {
  handleResendVerification,
  type ResendVerificationRequest,
} from "../../../../lib/auth/resend-verification.js";
import { missingEnv, notConfigured } from "../../../../lib/http.js";
import { makeAuthProvider, supabaseAdmin } from "../../../../lib/adapters/supabase.js";

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

export async function POST(request: Request): Promise<Response> {
  const missing = missingEnv(REQUIRED_ENV);
  if (missing.length) return notConfigured(`Auth is not configured (missing ${missing.join(", ")}).`);

  let body: ResendVerificationRequest;
  try {
    body = (await request.json()) as ResendVerificationRequest;
  } catch {
    return Response.json({ errors: ["Request body must be valid JSON."] }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const result = await handleResendVerification(body, { auth: makeAuthProvider(sb) });
  return Response.json(result.body, { status: result.status });
}
