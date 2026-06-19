export function GET(): Response {
  return Response.json({
    service: "vaultmind-backend",
    status: "ok",
    endpoints: ["/api/auth/register", "/api/contractscan/analyze", "/api/billing/webhook"],
  });
}
