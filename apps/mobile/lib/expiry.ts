import * as Notifications from "expo-notifications";
import * as Crypto from "expo-crypto";
import {
  trackDocument, untrack, urgencyFor, travelReadiness, todayIso, inferExpiryDocType,
  type ExpiryDocType, type TrackedDocument, type NotificationScheduler,
} from "@vaultmind/expiry-core";
import { SqliteTrackingRepo } from "./db";

/** Real OS local-notification scheduling — the mobile ExpiryGuard advantage. */
const scheduler: NotificationScheduler = {
  async schedule(input) {
    // fire at 9am local on the reminder day
    const fire = new Date(`${input.fireAt}T09:00:00`);
    if (fire.getTime() <= Date.now()) return "";
    return Notifications.scheduleNotificationAsync({
      content: { title: input.title, body: input.body },
      trigger: fire,
    });
  },
  async cancel(id) {
    if (id) await Notifications.cancelScheduledNotificationAsync(id);
  },
};

const deps = {
  ids: { newId: () => Crypto.randomUUID() },
  clock: { now: () => new Date() },
  notifications: scheduler,
};

export async function ensureNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === "granted";
}

export async function trackOnDevice(input: {
  docId: string; title: string; docType: ExpiryDocType; printedExpiry: string;
}) {
  const repo = new SqliteTrackingRepo();
  return trackDocument({ ...input, source: "manual" }, { ...deps, repo });
}

export async function untrackOnDevice(docId: string) {
  const repo = new SqliteTrackingRepo();
  await untrack(docId, { ...deps, repo });
}

export async function listTracked(): Promise<TrackedDocument[]> {
  return new SqliteTrackingRepo().list();
}

export { urgencyFor, travelReadiness, todayIso, inferExpiryDocType };
export type { ExpiryDocType, TrackedDocument };
