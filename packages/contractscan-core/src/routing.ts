/**
 * Tier routing (ARCHITECTURE §6.1, DECISIONS #3). Decides whether a contract is
 * analysed on-device by the SLM (Tier 1, no egress) or in the cloud by Gemini
 * (Tier 2, consent-gated). The subscriber's choice wins; the device's capability
 * and the document's size/complexity decide what's possible.
 */

export const TIER1_MAX_PAGES = 10;

export type UserTierChoice = "local" | "cloud" | "auto";

export interface RoutingInput {
  pageCount: number;
  /** can this device actually run the on-device SLM? (week-1 device test gate) */
  deviceCanRunSlm: boolean;
  /** subscriber preference (DECISIONS #3) */
  userChoice: UserTierChoice;
  /** optional pre-check signal that local analysis is likely low quality */
  localConfidencePreCheck?: number;
  /** multi-party contracts are routed to the cloud for depth */
  multiParty?: boolean;
}

export type RoutingDecision =
  | { tier: 1; requiresConsent: false; reason: string }
  | { tier: 2; requiresConsent: true; reason: string };

const LOCAL_PRECHECK_FLOOR = 0.5;

export function routeAnalysis(input: RoutingInput): RoutingDecision {
  if (input.userChoice === "cloud") {
    return { tier: 2, requiresConsent: true, reason: "User chose cloud analysis." };
  }

  const tooLong = input.pageCount > TIER1_MAX_PAGES;
  const lowLocalConfidence =
    input.localConfidencePreCheck !== undefined && input.localConfidencePreCheck < LOCAL_PRECHECK_FLOOR;

  if (!input.deviceCanRunSlm) {
    return { tier: 2, requiresConsent: true, reason: "This device can't run on-device analysis." };
  }
  if (tooLong) {
    return { tier: 2, requiresConsent: true, reason: `Document exceeds the ${TIER1_MAX_PAGES}-page on-device limit.` };
  }
  if (input.multiParty) {
    return { tier: 2, requiresConsent: true, reason: "Multi-party contract — cloud analysis is more reliable." };
  }
  if (lowLocalConfidence) {
    return { tier: 2, requiresConsent: true, reason: "On-device analysis looks low-confidence for this document." };
  }

  // userChoice "local" or "auto" with a capable device and a simple, short doc
  return { tier: 1, requiresConsent: false, reason: "Analysed privately on your device." };
}
