/**
 * POST /api/billing/webhook — Paystack webhook (ARCHITECTURE §7). The webhook is
 * the source of truth for entitlements.
 *
 * Phase 4 status: signature verification + event→entitlement mapping in
 * ../../../../lib/billing/paystack.ts are complete and tested. The EntitlementWriter
 * adapter (Supabase service role) is the placeholder below. The raw body must be
 * read as text BEFORE JSON parsing so the HMAC matches.
 */

import {
  verifyPaystackSignature,
  handlePaystackEvent,
  type PaystackEvent,
} from "../../../../lib/billing/paystack.js";
import { missingEnv, notConfigured } from "../../../../lib/http.js";
import { makeEntitlementWriter } from "../../../../lib/adapters/supabase.js";

export async function POST(request: Request): Promise<Response> {
  const missing = missingEnv(["PAYSTACK_SECRET_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  if (missing.length) return notConfigured(`Billing is not configured (missing ${missing.join(", ")}).`);

  const raw = await request.text();
  const signature = request.headers.get("x-paystack-signature") ?? "";
  const secret = process.env.PAYSTACK_SECRET_KEY ?? "";

  if (!verifyPaystackSignature(raw, signature, secret)) {
    return new Response("invalid signature", { status: 401 });
  }

  let evt: PaystackEvent;
  try {
    evt = JSON.parse(raw) as PaystackEvent;
  } catch {
    return new Response("bad json", { status: 400 });
  }

  await handlePaystackEvent(evt, { writer: makeEntitlementWriter(), now: () => new Date() });
  return new Response("ok", { status: 200 });
}
