/**
 * Document types ExpiryGuard tracks (ARCHITECTURE §4.3). Crucially this list
 * EXCLUDES the NIN (permanent) and the Voter's Card / PVC (does not expire) — both
 * were on the PRD's list in error (DECISIONS.md nit A); they remain vault
 * categories but are never expiry-tracked.
 */

export const EXPIRY_DOC_TYPES = [
  "international_passport",
  "visa_work_permit",
  "drivers_vehicle_licence",
  "insurance_policy",
  "professional_certificate",
  "tenancy_agreement",
  "waec_neco",
  "other", // unknown/manual — gets the default flat schedule (REQ-EXPIRY-005 floor)
] as const;

export type ExpiryDocType = (typeof EXPIRY_DOC_TYPES)[number];

/** Types that explicitly never expire — guarded so they can't be tracked. */
export const NON_EXPIRING_TYPES = new Set(["nin", "national_id", "voters_card", "pvc"]);

export function isExpiryDocType(x: string): x is ExpiryDocType {
  return (EXPIRY_DOC_TYPES as readonly string[]).includes(x);
}

/** True if a free-text type string is something we should NOT expiry-track. */
export function isNonExpiring(typeString: string): boolean {
  return NON_EXPIRING_TYPES.has(typeString.trim().toLowerCase().replace(/[\s-]+/g, "_"));
}

/**
 * Best-effort map from a free-text document type (e.g. the SLM's detected type or
 * a vault category) to an ExpiryDocType. Returns null for non-expiring types so the
 * caller can refuse to track them.
 */
export function inferExpiryDocType(typeString: string): ExpiryDocType | null {
  const t = typeString.trim().toLowerCase();
  // non-expiring documents (NIN, PVC/voter's card) must never be tracked
  if (isNonExpiring(t) || /\bnin\b|national\s*id|voter|pvc/.test(t)) return null;
  if (/passport/.test(t)) return "international_passport";
  if (/visa|work\s*permit|residence/.test(t)) return "visa_work_permit";
  if (/driver|vehicle|licen[cs]e/.test(t)) return "drivers_vehicle_licence";
  if (/insurance|policy|cover/.test(t)) return "insurance_policy";
  if (/certificate|certification|cpd|professional/.test(t)) return "professional_certificate";
  if (/tenancy|lease|rent/.test(t)) return "tenancy_agreement";
  if (/waec|neco|attestation/.test(t)) return "waec_neco";
  return "other";
}
