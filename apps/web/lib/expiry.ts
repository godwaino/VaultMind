"use client";

import {
  trackDocument,
  untrack,
  urgencyFor,
  travelReadiness,
  todayIso,
  inferExpiryDocType,
  type ExpiryDocType,
  type TrackedDocument,
} from "@vaultmind/expiry-core";
import { IdbTrackingRepo } from "./idb";

// Web has no OS reminder scheduler without a service worker + Web Push; this no-op
// records nothing OS-level. The dashboard still computes urgency + travel-readiness.
// (Real web push is a follow-up: a service worker subscribing via VAPID.)
const noopScheduler = { async schedule() { return ""; }, async cancel() {} };
const ids = { newId: () => crypto.randomUUID() };
const clock = { now: () => new Date() };

export async function trackOnWeb(input: {
  docId: string;
  title: string;
  docType: ExpiryDocType;
  printedExpiry: string;
}) {
  const repo = new IdbTrackingRepo();
  return trackDocument(
    { ...input, source: "manual" },
    { ids, clock, repo, notifications: noopScheduler }
  );
}

export async function untrackOnWeb(docId: string) {
  const repo = new IdbTrackingRepo();
  await untrack(docId, { ids, clock, repo, notifications: noopScheduler });
}

export async function listTracked(): Promise<TrackedDocument[]> {
  return new IdbTrackingRepo().list();
}

export { urgencyFor, travelReadiness, todayIso, inferExpiryDocType };
export type { ExpiryDocType, TrackedDocument };
