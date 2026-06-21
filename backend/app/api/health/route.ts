/**
 * GET /api/health — liveness for Vercel/uptime monitors (NFR-REL-001). Stateless,
 * touches no secrets, returns 200 as soon as the function is serving. Also reports
 * which integrations are configured (booleans only — never the secret values).
 */
import { missingEnv } from "../../../lib/http.js";

export async function GET(): Promise<Response> {
  return Response.json({
    status: "ok",
    service: "vaultmind-api",
    ts: new Date().toISOString(),
    configured: {
      supabase: missingEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]).length === 0,
      gemini: missingEnv(["GEMINI_API_KEY"]).length === 0,
      paystack: missingEnv(["PAYSTACK_SECRET_KEY"]).length === 0,
    },
  });
}
