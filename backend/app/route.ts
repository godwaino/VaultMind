/**
 * GET / — service health/identity endpoint.
 *
 * The backend is API-only (ARCHITECTURE §5): there is no web UI. This route
 * exists so the deployment root answers instead of 404ing, and gives
 * uptime checks something cheap to hit.
 */

export function GET(): Response {
  return Response.json({
    service: "vaultmind-backend",
    status: "ok",
    endpoints: ["/api/auth/register", "/api/contractscan/analyze", "/api/billing/webhook"],
  });
}
