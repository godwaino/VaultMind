/**
 * Free-tier limits (REQ-VAULT-022, monetisation table). Enforced in the domain
 * layer with a clear upgrade signal — never a silent failure (conversion metric).
 */

export const FREE_TIER_DOCUMENT_CAP = 50;

export interface CapStatus {
  used: number;
  cap: number;
  remaining: number;
  atCap: boolean;
  /** show the upgrade prompt as the user approaches the cap */
  shouldPromptUpgrade: boolean;
}

export function capStatus(used: number, cap = FREE_TIER_DOCUMENT_CAP): CapStatus {
  const remaining = Math.max(0, cap - used);
  return {
    used,
    cap,
    remaining,
    atCap: used >= cap,
    shouldPromptUpgrade: remaining <= 5,
  };
}
