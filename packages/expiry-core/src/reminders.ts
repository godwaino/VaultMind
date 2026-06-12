/**
 * Reminder construction (REQ-EXPIRY-005/007). Reminder dates are computed from the
 * EFFECTIVE expiry, and the copy names that effective deadline explicitly so a user
 * isn't misled by the printed date (ADR-008). Also supports the validation-mode
 * early reminder (DECISIONS.md #4) so testers experience an alert without waiting
 * ~89 days.
 */

import { subtractOffset, type DateOffset } from "./dates.js";
import type { ExpiryDocType } from "./docTypes.js";
import type { ReminderKind } from "./model.js";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatHumanDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

export const DOC_TYPE_LABEL: Record<ExpiryDocType, string> = {
  international_passport: "international passport",
  visa_work_permit: "visa / work permit",
  drivers_vehicle_licence: "driver's / vehicle licence",
  insurance_policy: "insurance policy",
  professional_certificate: "professional certificate",
  tenancy_agreement: "tenancy agreement",
  waec_neco: "WAEC/NECO result",
  other: "document",
};

function describeOffset(o: DateOffset): string {
  if (o.months) return `${o.months} month${o.months > 1 ? "s" : ""} before deadline`;
  if (o.days && o.days > 0) return `${o.days} day${o.days > 1 ? "s" : ""} before deadline`;
  return "on the renewal deadline";
}

export interface PlannedReminder {
  fireAt: string;
  offset: DateOffset;
  kind: ReminderKind;
  label: string;
  message: string;
}

function message(
  docType: ExpiryDocType,
  printedExpiry: string,
  effectiveExpiry: string
): string {
  const label = DOC_TYPE_LABEL[docType];
  if (effectiveExpiry !== printedExpiry) {
    // passport-style: effective deadline is earlier than the printed date
    return (
      `Your ${label} must be renewed by ${formatHumanDate(effectiveExpiry)} to stay usable ` +
      `(printed expiry ${formatHumanDate(printedExpiry)}; the 6-month validity rule applies).`
    );
  }
  return `Your ${label} expires on ${formatHumanDate(effectiveExpiry)}. Renew before then.`;
}

export interface BuildRemindersInput {
  docType: ExpiryDocType;
  printedExpiry: string;
  effectiveExpiry: string;
  schedule: DateOffset[];
}

export interface BuildRemindersOptions {
  /** today (yyyy-mm-dd) — used for the validation early reminder */
  today: string;
  /** if set, add a synthetic reminder this many days from today (DECISIONS #4) */
  validationEarlyDays?: number;
}

export function buildReminders(
  input: BuildRemindersInput,
  opts: BuildRemindersOptions
): PlannedReminder[] {
  const msg = message(input.docType, input.printedExpiry, input.effectiveExpiry);

  const planned: PlannedReminder[] = input.schedule.map((offset) => ({
    fireAt: subtractOffset(input.effectiveExpiry, offset),
    offset,
    kind: "scheduled" as const,
    label: describeOffset(offset),
    message: msg,
  }));

  if (opts.validationEarlyDays !== undefined) {
    planned.push({
      fireAt: subtractOffset(opts.today, { days: -opts.validationEarlyDays }),
      offset: { days: -opts.validationEarlyDays },
      kind: "validation_early",
      label: "validation preview",
      message: `(Preview) ${msg}`,
    });
  }

  // de-dupe identical fire dates, keep earliest-first
  const seen = new Set<string>();
  return planned
    .sort((a, b) => (a.fireAt < b.fireAt ? -1 : a.fireAt > b.fireAt ? 1 : 0))
    .filter((r) => {
      const key = `${r.fireAt}|${r.kind}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
