/**
 * POST /api/auth/register  (Next.js App Router route handler)
 *
 * Thin transport layer: parse JSON, delegate to handleRegister, map to HTTP.
 * Uses the web-standard Request/Response API (supported natively by the App
 * Router), so it carries no framework-specific types. The Supabase adapters are
 * constructed here from server-only env vars.
 *
 * NOTE (Phase 0 status): the Supabase adapters below are placeholders — wiring
 * @supabase/supabase-js with the service-role key happens when the project is
 * provisioned. The business logic in ../../../../lib/auth/register.ts is complete
 * and tested.
 */

import { handleRegister, type RegisterRequest } from "../../../../lib/auth/register.js";
import { DuplicateEmailError, type AuthProvider, type ProfileStore } from "../../../../lib/ports.js";

// --- placeholder adapters; replace with Supabase-backed implementations ---
const auth: AuthProvider = {
  async createUser() {
    throw new Error("Supabase AuthProvider not configured (Phase 0 placeholder)");
    // Real impl: supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: false })
    //   -> on 'User already registered' throw new DuplicateEmailError()
  },
};
const profiles: ProfileStore = {
  async insertProfile() {
    throw new Error("Supabase ProfileStore not configured (Phase 0 placeholder)");
  },
};
void DuplicateEmailError; // referenced by the real adapter

export async function POST(request: Request): Promise<Response> {
  let body: RegisterRequest;
  try {
    body = (await request.json()) as RegisterRequest;
  } catch {
    return Response.json({ errors: ["Request body must be valid JSON."] }, { status: 400 });
  }

  const result = await handleRegister(body, { auth, profiles });
  return Response.json(result.body, { status: result.status });
}
