/**
 * POST /api/auth/register (Next.js App Router) — REQ-AUTH-001..003.
 * Returns 501 until Supabase is configured; otherwise uses the real Supabase
 * adapters (service role). Business logic lives in lib/auth/register.ts (tested).
 */

import { handleRegister, type RegisterRequest } from "../../../../lib/auth/register.js";
import { missingEnv, notConfigured } from "../../../../lib/http.js";
import { makeAuthProvider, makeProfileStore, supabaseAdmin } from "../../../../lib/adapters/supabase.js";

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

export async function POST(request: Request): Promise<Response> {
  try {
    const missing = missingEnv(REQUIRED_ENV);
    if (missing.length) return notConfigured(`Auth is not configured (missing ${missing.join(", ")}).`);

    let body: RegisterRequest;
    try {
      body = (await request.json()) as RegisterRequest;
    } catch {
      return Response.json({ errors: ["Request body must be valid JSON."] }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const result = await handleRegister(body, {
      auth: makeAuthProvider(sb),
      profiles: makeProfileStore(sb),
    });
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: "server_error", detail: message },
      { status: 500 }
    );
  }
}
