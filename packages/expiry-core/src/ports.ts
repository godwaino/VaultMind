/**
 * Ports for ExpiryGuard. Local notifications are the primary channel (ARCHITECTURE
 * §4.3, ADR-002) and work fully offline (REQ-EXPIRY-009); the device adapter wraps
 * Expo Notifications. The email channel is opt-in and minimal — only a user-chosen
 * label and a fire date, never document content.
 */

import type { TrackedDocument } from "./model.js";

export interface IdProvider {
  newId(): string;
}
export interface Clock {
  now(): Date;
}

export interface ScheduleInput {
  docId: string;
  reminderId: string;
  /** ISO yyyy-mm-dd */
  fireAt: string;
  title: string;
  body: string;
}

/** OS-level local notification scheduler (Expo Notifications on device). */
export interface NotificationScheduler {
  /** returns the OS notification id; implementations skip past `fireAt` dates */
  schedule(input: ScheduleInput): Promise<string>;
  cancel(notificationId: string): Promise<void>;
}

/** Opt-in email secondary channel (default off). Minimal data only. */
export interface EmailReminderRegistry {
  register(input: { docId: string; label: string; fireAt: string }): Promise<void>;
  clearForDoc(docId: string): Promise<void>;
}

export interface TrackingRepo {
  insert(t: TrackedDocument): Promise<void>;
  update(t: TrackedDocument): Promise<void>;
  get(docId: string): Promise<TrackedDocument | null>;
  list(): Promise<TrackedDocument[]>;
  liveCount(): Promise<number>;
  remove(docId: string): Promise<void>;
}
