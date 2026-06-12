/**
 * ExpiryGuard domain model. A TrackedDocument references a vault document that has
 * an expiry; it carries the computed effective expiry and the reminder set. Like
 * the vault, none of this leaves the device (NFR-SEC-006); the optional email
 * channel registers only a user-chosen label + a fire date (ARCHITECTURE §4.3).
 */

import type { DateOffset } from "./dates.js";
import type { ExpiryDocType } from "./docTypes.js";

export type ReminderKind = "scheduled" | "validation_early";

export interface Reminder {
  id: string;
  /** ISO yyyy-mm-dd the reminder should fire */
  fireAt: string;
  /** the schedule offset this came from (before the effective expiry) */
  offset: DateOffset;
  kind: ReminderKind;
  /** short user-facing label, e.g. "1 month before renewal deadline" */
  label: string;
  /** notification body naming the effective deadline (REQ-EXPIRY-007) */
  message: string;
  dismissed: boolean;
  /** id returned by the OS notification scheduler, if scheduled */
  notificationId?: string;
}

export type ExpirySource = "extracted" | "manual";

export interface TrackedDocument {
  docId: string;
  title: string;
  docType: ExpiryDocType;
  /** the date printed on the document */
  printedExpiry: string;
  /** printed minus the policy's effective-expiry offset (ADR-008) */
  effectiveExpiry: string;
  policyVersion: number;
  reminders: Reminder[];
  source: ExpirySource;
  /** extraction confidence 0..1 when source = "extracted" */
  confidence?: number;
  /** expired doc the user has since replaced (REQ-EXPIRY-013) */
  replaced: boolean;
  createdAt: string;
  updatedAt: string;
}
