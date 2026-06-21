/**
 * Small HTTP helpers shared by the route handlers. The key one is `notConfigured`:
 * before any adapter is wired (Supabase, Gemini, Paystack), routes should return a
 * clean 501 rather than throwing a 500 — so a freshly-deployed app responds
 * predictably and uptime checks stay green while credentials are added.
 */

export function notConfigured(detail: string): Response {
  return Response.json({ error: "not_configured", detail }, { status: 501 });
}

/** Names of the env vars in `required` that are missing/empty. */
export function missingEnv(required: string[]): string[] {
  return required.filter((name) => {
    const v = process.env[name];
    return v === undefined || v === "";
  });
}
