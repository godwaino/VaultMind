/**
 * Paystack billing (ARCHITECTURE §7, REQ-AUTH/monetisation). The webhook is the
 * source of truth for entitlements; we verify its signature, map events to a tier,
 * and apply the early-access 12-month price lock. Webhook handlers are pure over
 * injected stores, so they're unit-tested without Paystack or a database.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Tier } from "../contractscan/ports.js";

/** Verify the `x-paystack-signature` header (HMAC-SHA512 of the raw body). */
export function verifyPaystackSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha512", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature ?? "", "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface PaystackEvent {
  event: string; // 'charge.success' | 'subscription.create' | 'subscription.disable' | ...
  data: {
    customer?: { customer_code?: string; email?: string };
    plan?: { plan_code?: string };
    subscription_code?: string;
    next_payment_date?: string;
    metadata?: { user_id?: string; early_access?: boolean };
  };
}

export interface EntitlementUpdate {
  userId: string;
  tier: Tier;
  paystackCustomerId?: string;
  paystackSubId?: string;
  currentPeriodEnd?: string;
  earlyAccessLockUntil?: string;
}

export interface EntitlementWriter {
  apply(update: EntitlementUpdate): Promise<void>;
}

/** Map a Paystack plan code to a VaultMind tier (configure real codes in env). */
export function tierForPlan(planCode: string | undefined): Tier {
  if (!planCode) return "free";
  if (/family/i.test(planCode)) return "family";
  if (/personal|early/i.test(planCode)) return "personal";
  return "free";
}

export const EARLY_ACCESS_LOCK_MONTHS = 12;

function addMonthsIso(fromIso: string, months: number): string {
  const d = new Date(fromIso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString();
}

export type WebhookResult =
  | { handled: true; update: EntitlementUpdate }
  | { handled: false; reason: string };

export async function handlePaystackEvent(
  evt: PaystackEvent,
  deps: { writer: EntitlementWriter; now: () => Date }
): Promise<WebhookResult> {
  const userId = evt.data.metadata?.user_id;
  if (!userId) return { handled: false, reason: "no user_id in metadata" };

  const nowIso = deps.now().toISOString();

  if (evt.event === "charge.success" || evt.event === "subscription.create") {
    const tier = tierForPlan(evt.data.plan?.plan_code);
    const update: EntitlementUpdate = {
      userId,
      tier,
      ...(evt.data.customer?.customer_code ? { paystackCustomerId: evt.data.customer.customer_code } : {}),
      ...(evt.data.subscription_code ? { paystackSubId: evt.data.subscription_code } : {}),
      ...(evt.data.next_payment_date ? { currentPeriodEnd: evt.data.next_payment_date } : {}),
    };
    // Early-access price is locked for 12 months from first activation.
    if (evt.data.metadata?.early_access) {
      update.earlyAccessLockUntil = addMonthsIso(nowIso, EARLY_ACCESS_LOCK_MONTHS);
    }
    await deps.writer.apply(update);
    return { handled: true, update };
  }

  if (evt.event === "subscription.disable" || evt.event === "subscription.not_renew") {
    const update: EntitlementUpdate = { userId, tier: "free" };
    await deps.writer.apply(update);
    return { handled: true, update };
  }

  return { handled: false, reason: `unhandled event ${evt.event}` };
}
