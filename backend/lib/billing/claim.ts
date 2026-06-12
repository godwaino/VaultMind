/**
 * Offline entitlement claim (ARCHITECTURE §7). The server issues a short-TTL,
 * HMAC-signed claim of the user's tier so the app can enforce tier checks (caps,
 * backup availability, ContractScan quota) while offline. Server-side features
 * (Tier-2, backup upload) are still enforced server-side regardless; this only
 * gates the *client* UX between refreshes.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Tier } from "../contractscan/ports.js";

export interface EntitlementClaim {
  userId: string;
  tier: Tier;
  /** unix seconds */
  exp: number;
}

function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}

export function createEntitlementClaim(
  claim: EntitlementClaim,
  secret: string
): string {
  const payload = b64url(JSON.stringify(claim));
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export type ClaimVerification =
  | { ok: true; claim: EntitlementClaim }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export function verifyEntitlementClaim(
  token: string,
  secret: string,
  nowUnix: number
): ClaimVerification {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [payload, sig] = parts as [string, string];

  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "bad_signature" };

  let claim: EntitlementClaim;
  try {
    claim = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as EntitlementClaim;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (claim.exp <= nowUnix) return { ok: false, reason: "expired" };
  return { ok: true, claim };
}
