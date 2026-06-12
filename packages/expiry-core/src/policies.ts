/**
 * Per-document-type reminder policies with "effective expiry" (ADR-008,
 * ARCHITECTURE §4.3). The key idea: a document's *usable* life can end before its
 * printed date. The canonical case is the international passport — most countries
 * enforce a 6-month validity rule and NIS renewal takes weeks, so a passport with
 * <6 months left is already unusable for travel. We therefore reminder against the
 * EFFECTIVE expiry (printed minus an offset), not the printed date.
 *
 * This table ships as versioned, remotely-updatable JSON alongside the renewal
 * guidance; `POLICY_TABLE_VERSION` lets the device know when to refetch. The flat
 * 90/30/7/0 schedule remains the default for unknown/manual types, satisfying
 * REQ-EXPIRY-005 as the floor.
 */

import type { DateOffset } from "./dates.js";
import type { ExpiryDocType } from "./docTypes.js";

export const POLICY_TABLE_VERSION = 1;

export interface ReminderPolicy {
  docType: ExpiryDocType;
  /** subtract from the printed expiry to get the EFFECTIVE expiry */
  effectiveExpiryOffset: DateOffset;
  /** each entry is subtracted from the effective expiry to get a reminder date */
  schedule: DateOffset[];
  rationale: string;
}

const DEFAULT_SCHEDULE: DateOffset[] = [
  { days: 90 },
  { days: 30 },
  { days: 7 },
  { days: 0 },
];

export const REMINDER_POLICIES: Record<ExpiryDocType, ReminderPolicy> = {
  international_passport: {
    docType: "international_passport",
    effectiveExpiryOffset: { months: 6 }, // 6-month validity rule
    schedule: [{ months: 6 }, { months: 3 }, { months: 1 }, { days: 7 }, { days: 0 }],
    rationale: "Most countries require 6 months' passport validity; NIS renewal has weeks of lead time.",
  },
  visa_work_permit: {
    docType: "visa_work_permit",
    effectiveExpiryOffset: { days: 0 },
    schedule: [{ days: 90 }, { days: 30 }, { days: 7 }, { days: 0 }],
    rationale: "Some classes must be renewed before a closing window.",
  },
  drivers_vehicle_licence: {
    docType: "drivers_vehicle_licence",
    effectiveExpiryOffset: { days: 0 },
    schedule: [{ days: 60 }, { days: 30 }, { days: 7 }, { days: 0 }],
    rationale: "FRSC renewal takes days to weeks.",
  },
  insurance_policy: {
    docType: "insurance_policy",
    effectiveExpiryOffset: { days: 0 },
    schedule: [{ days: 30 }, { days: 14 }, { days: 7 }, { days: 0 }],
    rationale: "A lapse voids cover; renewal is fast.",
  },
  professional_certificate: {
    docType: "professional_certificate",
    effectiveExpiryOffset: { days: 0 },
    schedule: [{ days: 90 }, { days: 30 }, { days: 7 }, { days: 0 }],
    rationale: "CPD requirements may need months of lead time.",
  },
  tenancy_agreement: {
    docType: "tenancy_agreement",
    effectiveExpiryOffset: { days: 0 },
    schedule: [{ days: 90 }, { days: 60 }, { days: 30 }, { days: 0 }],
    rationale: "Notice periods are typically one to three months.",
  },
  waec_neco: {
    docType: "waec_neco",
    effectiveExpiryOffset: { days: 0 },
    schedule: DEFAULT_SCHEDULE,
    rationale: "Default schedule.",
  },
  other: {
    docType: "other",
    effectiveExpiryOffset: { days: 0 },
    schedule: DEFAULT_SCHEDULE,
    rationale: "Default flat schedule for unknown or manually-entered types (REQ-EXPIRY-005 floor).",
  },
};

export function policyFor(docType: ExpiryDocType): ReminderPolicy {
  return REMINDER_POLICIES[docType];
}
