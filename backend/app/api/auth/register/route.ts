/**
 * POST /api/auth/register  (Next.js App Router route handler)
 *
 * Thin transport layer: parse JSON, delegate to handleRegister, map to HTTP.
 * The Supabase adapters are constructed lazily inside the handler so cold
 * starts do not crash when env vars are evaluated at module load.
 */

import { handleRegister, type RegisterRequest } from "../../../../lib/auth/register.js";
import {
  supabaseAuthProvider,
  supabaseProfileStore,
} from "../../../../lib/supabase/adapters.js";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: RegisterRequest;
  try {
    body = (await request.json()) as RegisterRequest;
  } catch {
    return Response.json({ errors: ["Request body must be valid JSON."] }, { status: 400 });
  }

  const result = await handleRegister(body, {
    auth: supabaseAuthProvider,
    profiles: supabaseProfileStore,
  });
  return Response.json(result.body, { status: result.status });
}
