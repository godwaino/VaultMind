/**
 * POST /api/account/delete — one-tap erasure (NFR-SEC-007). Marks the profile
 * deleted and queues the rows (≤24h) and blobs (≤72h) purges; a Vercel cron worker
 * drains `purge_jobs`. The user id comes from the verified JWT at the edge.
 */

import { requestErasure } from "../../../../lib/account/account.js";
import { missingEnv, notConfigured } from "../../../../lib/http.js";
import { makeErasurePorts } from "../../../../lib/adapters/supabase.js";

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

export async function POST(request: Request): Promise<Response> {
  const missing = missingEnv(REQUIRED_ENV);
  if (missing.length) return notConfigured(`Account deletion is not configured (missing ${missing.join(", ")}).`);

  let userId: string;
  try {
    ({ userId } = (await request.json()) as { userId: string });
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

  const ports = makeErasurePorts();
  const result = await requestErasure(userId, { ...ports, now: () => new Date() });
  return Response.json(result);
}
