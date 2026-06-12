/**
 * Travel-readiness check (ARCHITECTURE §4.3) — the highest-leverage ExpiryGuard
 * feature. "I'm travelling on <date>" evaluates every travel-relevant tracked
 * document against the trip date and flags failures NOW, rather than at the next
 * scheduled reminder. Pure client-side computation over data already held; no new
 * data collection. This is what catches a passport that's 2 months from its
 * 6-month cutoff before a trip next week.
 */

import { daysBetween } from "./dates.js";
import { DOC_TYPE_LABEL } from "./reminders.js";
import type { TrackedDocument } from "./model.js";
import type { ExpiryDocType } from "./docTypes.js";

const TRAVEL_RELEVANT: ReadonlySet<ExpiryDocType> = new Set<ExpiryDocType>([
  "international_passport",
  "visa_work_permit",
]);

export type TravelIssueSeverity = "blocker" | "warning";

export interface TravelIssue {
  docId: string;
  docType: ExpiryDocType;
  severity: TravelIssueSeverity;
  message: string;
}

export interface TravelReadiness {
  ready: boolean;
  tripDate: string;
  issues: TravelIssue[];
  checkedDocIds: string[];
}

/**
 * @param warnWithinDays raise a (non-blocking) warning when a travel doc is valid
 *   for the trip but only barely — default 30 days of margin.
 */
export function travelReadiness(
  tracked: TrackedDocument[],
  tripDate: string,
  opts: { warnWithinDays?: number } = {}
): TravelReadiness {
  const warnWithin = opts.warnWithinDays ?? 30;
  const issues: TravelIssue[] = [];
  const checkedDocIds: string[] = [];

  for (const doc of tracked) {
    if (!TRAVEL_RELEVANT.has(doc.docType) || doc.replaced) continue;
    checkedDocIds.push(doc.docId);

    // Passports are judged on EFFECTIVE validity (6-month rule already applied);
    // visas on their printed date.
    const usableUntil =
      doc.docType === "international_passport" ? doc.effectiveExpiry : doc.printedExpiry;
    const margin = daysBetween(tripDate, usableUntil);
    const label = DOC_TYPE_LABEL[doc.docType];

    if (margin < 0) {
      issues.push({
        docId: doc.docId,
        docType: doc.docType,
        severity: "blocker",
        message:
          doc.docType === "international_passport"
            ? `Your ${label} will not meet the 6-month validity rule for travel on ${tripDate} (usable until ${usableUntil}). Renew before you travel.`
            : `Your ${label} expires before your trip on ${tripDate} (valid until ${usableUntil}).`,
      });
    } else if (margin <= warnWithin) {
      issues.push({
        docId: doc.docId,
        docType: doc.docType,
        severity: "warning",
        message: `Your ${label} is only valid until ${usableUntil} — a thin margin for travel on ${tripDate}.`,
      });
    }
  }

  return {
    ready: !issues.some((i) => i.severity === "blocker"),
    tripDate,
    issues,
    checkedDocIds,
  };
}
