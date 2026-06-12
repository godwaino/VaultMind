/**
 * Tracking orchestration (REQ-EXPIRY-002..009). Creates/updates TrackedDocuments,
 * computes the effective expiry + reminders, schedules local notifications, and
 * enforces the free-tier cap. Extraction below the confidence threshold does NOT
 * auto-track — it asks the user to confirm the date (REQ-EXPIRY-003).
 */

import { isIsoDate, subtractOffset, todayIso } from "./dates.js";
import { isNonExpiring, type ExpiryDocType } from "./docTypes.js";
import { policyFor, POLICY_TABLE_VERSION } from "./policies.js";
import { buildReminders } from "./reminders.js";
import { DOC_TYPE_LABEL } from "./reminders.js";
import type { Reminder, TrackedDocument } from "./model.js";
import type {
  Clock,
  EmailReminderRegistry,
  IdProvider,
  NotificationScheduler,
  TrackingRepo,
} from "./ports.js";

/** Free-tier cap on tracked documents (monetisation table). */
export const FREE_TIER_TRACKING_CAP = 5;

/** Below this extraction confidence, require the user to confirm the date. */
export const EXTRACTION_CONFIDENCE_THRESHOLD = 0.7;

export interface TrackDeps {
  ids: IdProvider;
  clock: Clock;
  repo: TrackingRepo;
  notifications: NotificationScheduler;
  email?: EmailReminderRegistry;
  /** opt-in email channel (default off) */
  emailEnabled?: boolean;
  /** free-tier cap; omit for unlimited (paid) */
  maxTracked?: number;
  /** validation/beta: also fire a synthetic early reminder (DECISIONS #4) */
  validationEarlyDays?: number;
}

export interface TrackInput {
  docId: string;
  title: string;
  docType: ExpiryDocType;
  printedExpiry: string;
  source: "extracted" | "manual";
  /** required when source = "extracted" */
  confidence?: number;
}

export type TrackResult =
  | { ok: true; tracked: TrackedDocument }
  | { ok: false; reason: "invalid_date" }
  | { ok: false; reason: "non_expiring_type" }
  | { ok: false; reason: "needs_manual_confirmation"; suggested: string }
  | { ok: false; reason: "limit_reached"; limit: number }
  | { ok: false; reason: "already_tracked" };

async function scheduleReminders(
  doc: TrackedDocument,
  deps: TrackDeps
): Promise<Reminder[]> {
  const today = todayIso(() => deps.clock.now());
  const planned = buildReminders(
    {
      docType: doc.docType,
      printedExpiry: doc.printedExpiry,
      effectiveExpiry: doc.effectiveExpiry,
      schedule: policyFor(doc.docType).schedule,
    },
    {
      today,
      ...(deps.validationEarlyDays !== undefined
        ? { validationEarlyDays: deps.validationEarlyDays }
        : {}),
    }
  );

  const reminders: Reminder[] = [];
  for (const p of planned) {
    const id = deps.ids.newId();
    const notificationId = await deps.notifications.schedule({
      docId: doc.docId,
      reminderId: id,
      fireAt: p.fireAt,
      title: `Renewal reminder: ${DOC_TYPE_LABEL[doc.docType]}`,
      body: p.message,
    });
    reminders.push({
      id,
      fireAt: p.fireAt,
      offset: p.offset,
      kind: p.kind,
      label: p.label,
      message: p.message,
      dismissed: false,
      ...(notificationId ? { notificationId } : {}),
    });
    if (deps.emailEnabled && deps.email) {
      await deps.email.register({ docId: doc.docId, label: doc.title, fireAt: p.fireAt });
    }
  }
  return reminders;
}

export async function trackDocument(input: TrackInput, deps: TrackDeps): Promise<TrackResult> {
  if (isNonExpiring(input.docType)) return { ok: false, reason: "non_expiring_type" };
  if (!isIsoDate(input.printedExpiry)) return { ok: false, reason: "invalid_date" };

  if (input.source === "extracted" && (input.confidence ?? 0) < EXTRACTION_CONFIDENCE_THRESHOLD) {
    return { ok: false, reason: "needs_manual_confirmation", suggested: input.printedExpiry };
  }

  if (await deps.repo.get(input.docId)) return { ok: false, reason: "already_tracked" };

  if (deps.maxTracked !== undefined && (await deps.repo.liveCount()) >= deps.maxTracked) {
    return { ok: false, reason: "limit_reached", limit: deps.maxTracked };
  }

  const policy = policyFor(input.docType);
  const effectiveExpiry = subtractOffset(input.printedExpiry, policy.effectiveExpiryOffset);
  const now = deps.clock.now().toISOString();

  const doc: TrackedDocument = {
    docId: input.docId,
    title: input.title,
    docType: input.docType,
    printedExpiry: input.printedExpiry,
    effectiveExpiry,
    policyVersion: POLICY_TABLE_VERSION,
    reminders: [],
    source: input.source,
    ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
    replaced: false,
    createdAt: now,
    updatedAt: now,
  };
  doc.reminders = await scheduleReminders(doc, deps);
  await deps.repo.insert(doc);
  return { ok: true, tracked: doc };
}

async function cancelAll(doc: TrackedDocument, deps: TrackDeps): Promise<void> {
  for (const r of doc.reminders) {
    if (r.notificationId) await deps.notifications.cancel(r.notificationId);
  }
  if (deps.emailEnabled && deps.email) await deps.email.clearForDoc(doc.docId);
}

/** Change the expiry date (REQ-EXPIRY-004) and reschedule all reminders. */
export async function updateExpiry(
  docId: string,
  newPrintedExpiry: string,
  deps: TrackDeps
): Promise<TrackResult> {
  if (!isIsoDate(newPrintedExpiry)) return { ok: false, reason: "invalid_date" };
  const doc = await deps.repo.get(docId);
  if (!doc) return { ok: false, reason: "already_tracked" }; // not found; caller checks

  await cancelAll(doc, deps);
  const policy = policyFor(doc.docType);
  doc.printedExpiry = newPrintedExpiry;
  doc.effectiveExpiry = subtractOffset(newPrintedExpiry, policy.effectiveExpiryOffset);
  doc.source = "manual";
  doc.replaced = false;
  doc.updatedAt = deps.clock.now().toISOString();
  doc.reminders = await scheduleReminders(doc, deps);
  await deps.repo.update(doc);
  return { ok: true, tracked: doc };
}

/** Dismiss one reminder; the rest stay scheduled (REQ-EXPIRY-008). */
export async function dismissReminder(
  docId: string,
  reminderId: string,
  deps: TrackDeps
): Promise<TrackedDocument | null> {
  const doc = await deps.repo.get(docId);
  if (!doc) return null;
  const r = doc.reminders.find((x) => x.id === reminderId);
  if (!r) return doc;
  r.dismissed = true;
  if (r.notificationId) {
    await deps.notifications.cancel(r.notificationId);
    delete r.notificationId;
  }
  doc.updatedAt = deps.clock.now().toISOString();
  await deps.repo.update(doc);
  return doc;
}

/** Mark an expired document as replaced/renewed (REQ-EXPIRY-013). */
export async function markReplaced(docId: string, deps: TrackDeps): Promise<TrackedDocument | null> {
  const doc = await deps.repo.get(docId);
  if (!doc) return null;
  await cancelAll(doc, deps);
  doc.replaced = true;
  doc.updatedAt = deps.clock.now().toISOString();
  await deps.repo.update(doc);
  return doc;
}

export async function untrack(docId: string, deps: TrackDeps): Promise<void> {
  const doc = await deps.repo.get(docId);
  if (!doc) return;
  await cancelAll(doc, deps);
  await deps.repo.remove(docId);
}
