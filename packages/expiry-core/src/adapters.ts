/**
 * In-memory adapters for tests/dev. On device: Expo Notifications, a Vercel-cron +
 * Resend email registry, and an encrypted-SQLite tracking repo.
 */

import type {
  Clock,
  EmailReminderRegistry,
  IdProvider,
  NotificationScheduler,
  ScheduleInput,
  TrackingRepo,
} from "./ports.js";
import type { TrackedDocument } from "./model.js";

export class InMemoryTrackingRepo implements TrackingRepo {
  private readonly map = new Map<string, TrackedDocument>();
  async insert(t: TrackedDocument): Promise<void> {
    if (this.map.has(t.docId)) throw new Error(`Already tracking ${t.docId}`);
    this.map.set(t.docId, structuredClone(t));
  }
  async update(t: TrackedDocument): Promise<void> {
    if (!this.map.has(t.docId)) throw new Error(`Not tracking ${t.docId}`);
    this.map.set(t.docId, structuredClone(t));
  }
  async get(docId: string): Promise<TrackedDocument | null> {
    const v = this.map.get(docId);
    return v ? structuredClone(v) : null;
  }
  async list(): Promise<TrackedDocument[]> {
    return [...this.map.values()].map((t) => structuredClone(t));
  }
  async liveCount(): Promise<number> {
    return this.map.size;
  }
  async remove(docId: string): Promise<void> {
    this.map.delete(docId);
  }
}

/** Records scheduled notifications; skips any fireAt strictly before `today`. */
export class InMemoryNotificationScheduler implements NotificationScheduler {
  readonly scheduled = new Map<string, ScheduleInput>();
  private seq = 0;
  constructor(private readonly today: () => string) {}
  async schedule(input: ScheduleInput): Promise<string> {
    if (input.fireAt < this.today()) return ""; // past — nothing to schedule
    const id = `notif_${++this.seq}`;
    this.scheduled.set(id, input);
    return id;
  }
  async cancel(notificationId: string): Promise<void> {
    this.scheduled.delete(notificationId);
  }
  get activeCount(): number {
    return this.scheduled.size;
  }
}

export class InMemoryEmailReminderRegistry implements EmailReminderRegistry {
  readonly rows: { docId: string; label: string; fireAt: string }[] = [];
  async register(input: { docId: string; label: string; fireAt: string }): Promise<void> {
    this.rows.push({ ...input });
  }
  async clearForDoc(docId: string): Promise<void> {
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (this.rows[i]!.docId === docId) this.rows.splice(i, 1);
    }
  }
}

let counter = 0;
export const sequentialIdProvider: IdProvider = {
  newId: () => `rem_${(++counter).toString(36).padStart(6, "0")}`,
};

export function fixedClock(startIso = "2026-06-01T00:00:00.000Z"): Clock {
  return { now: () => new Date(startIso) };
}
