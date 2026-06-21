/**
 * GET /api/health — liveness check for Vercel/uptime monitors (NFR-REL-001).
 * Stateless; no secrets touched. Returns 200 as soon as the app is serving.
 */
export async function GET(): Promise<Response> {
  return Response.json({ status: "ok", service: "vaultmind-web", ts: new Date().toISOString() });
}
