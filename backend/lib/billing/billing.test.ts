import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  verifyPaystackSignature,
  handlePaystackEvent,
  tierForPlan,
  type PaystackEvent,
  type EntitlementUpdate,
  type EntitlementWriter,
} from "./paystack.js";
import { createEntitlementClaim, verifyEntitlementClaim } from "./claim.js";

const SECRET = "sk_test_secret";

describe("Paystack signature", () => {
  it("accepts a correct HMAC-SHA512 signature and rejects a bad one", () => {
    const body = JSON.stringify({ event: "charge.success" });
    const sig = createHmac("sha512", SECRET).update(body).digest("hex");
    expect(verifyPaystackSignature(body, sig, SECRET)).toBe(true);
    expect(verifyPaystackSignature(body, "deadbeef", SECRET)).toBe(false);
    expect(verifyPaystackSignature(body, sig, "wrong-secret")).toBe(false);
  });
});

describe("tierForPlan", () => {
  it("maps plan codes to tiers", () => {
    expect(tierForPlan("PLN_personal_monthly")).toBe("personal");
    expect(tierForPlan("PLN_early_access")).toBe("personal");
    expect(tierForPlan("PLN_family")).toBe("family");
    expect(tierForPlan(undefined)).toBe("free");
  });
});

function writerSpy() {
  const applied: EntitlementUpdate[] = [];
  const writer: EntitlementWriter = { async apply(u) { applied.push(u); } };
  return { writer, applied };
}
const now = () => new Date("2026-06-15T00:00:00.000Z");

describe("handlePaystackEvent", () => {
  it("activates a personal subscription and sets the 12-month early-access lock", async () => {
    const s = writerSpy();
    const evt: PaystackEvent = {
      event: "charge.success",
      data: {
        customer: { customer_code: "CUS_1" },
        plan: { plan_code: "PLN_early_access" },
        subscription_code: "SUB_1",
        next_payment_date: "2026-07-15T00:00:00Z",
        metadata: { user_id: "u1", early_access: true },
      },
    };
    const res = await handlePaystackEvent(evt, { writer: s.writer, now });
    expect(res.handled).toBe(true);
    if (res.handled) {
      expect(res.update.tier).toBe("personal");
      expect(res.update.earlyAccessLockUntil).toBe("2027-06-15T00:00:00.000Z");
    }
    expect(s.applied).toHaveLength(1);
  });

  it("downgrades to free on subscription.disable", async () => {
    const s = writerSpy();
    const res = await handlePaystackEvent(
      { event: "subscription.disable", data: { metadata: { user_id: "u1" } } },
      { writer: s.writer, now }
    );
    expect(res.handled).toBe(true);
    if (res.handled) expect(res.update.tier).toBe("free");
  });

  it("ignores events without a user_id or unhandled types", async () => {
    const s = writerSpy();
    expect((await handlePaystackEvent({ event: "charge.success", data: {} }, { writer: s.writer, now })).handled).toBe(false);
    expect((await handlePaystackEvent({ event: "invoice.create", data: { metadata: { user_id: "u1" } } }, { writer: s.writer, now })).handled).toBe(false);
  });
});

describe("offline entitlement claim", () => {
  it("round-trips a valid claim", () => {
    const token = createEntitlementClaim({ userId: "u1", tier: "personal", exp: 2000000000 }, SECRET);
    const v = verifyEntitlementClaim(token, SECRET, 1000000000);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.claim.tier).toBe("personal");
  });
  it("rejects tampered, wrong-secret, and expired claims", () => {
    const token = createEntitlementClaim({ userId: "u1", tier: "family", exp: 2000000000 }, SECRET);
    expect(verifyEntitlementClaim(token + "x", SECRET, 1000000000).ok).toBe(false);
    expect(verifyEntitlementClaim(token, "other", 1000000000).ok).toBe(false);
    const expired = verifyEntitlementClaim(token, SECRET, 2000000001);
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.reason).toBe("expired");
  });
});
