import { describe, it, expect, beforeEach } from "vitest";
import {
  subtractOffset,
  daysBetween,
  isIsoDate,
  inferExpiryDocType,
  policyFor,
  trackDocument,
  updateExpiry,
  dismissReminder,
  markReplaced,
  urgencyFor,
  travelReadiness,
  guidanceFor,
  buildReminders,
  InMemoryTrackingRepo,
  InMemoryNotificationScheduler,
  InMemoryEmailReminderRegistry,
  sequentialIdProvider,
  toIsoDate,
  type TrackDeps,
  type TrackedDocument,
} from "./index.js";

describe("date math", () => {
  it("subtracts calendar months with end-of-month clamping", () => {
    expect(subtractOffset("2027-08-31", { months: 6 })).toBe("2027-02-28");
    expect(subtractOffset("2027-01-15", { months: 1 })).toBe("2026-12-15");
  });
  it("subtracts days and supports negative (adds) days", () => {
    expect(subtractOffset("2027-01-01", { days: 7 })).toBe("2026-12-25");
    expect(subtractOffset("2026-06-01", { days: -1 })).toBe("2026-06-02");
  });
  it("daysBetween and isIsoDate", () => {
    expect(daysBetween("2026-06-01", "2026-06-08")).toBe(7);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-06-01")).toBe(true);
  });
});

describe("doc-type inference (NIN/PVC excluded)", () => {
  it("maps passports/tenancy and refuses non-expiring types", () => {
    expect(inferExpiryDocType("International Passport")).toBe("international_passport");
    expect(inferExpiryDocType("rent/tenancy agreement")).toBe("tenancy_agreement");
    expect(inferExpiryDocType("NIN slip")).toBeNull();
    expect(inferExpiryDocType("Voter's Card")).toBeNull();
  });
});

describe("effective expiry policy (ADR-008)", () => {
  it("passport effective expiry is printed minus 6 months; earliest reminder is printed minus 12 months", () => {
    const printed = "2027-01-01";
    const effective = subtractOffset(printed, policyFor("international_passport").effectiveExpiryOffset);
    expect(effective).toBe("2026-07-01");
    const reminders = buildReminders(
      { docType: "international_passport", printedExpiry: printed, effectiveExpiry: effective, schedule: policyFor("international_passport").schedule },
      { today: "2025-01-01" }
    );
    // earliest reminder = effective - 6 months = printed - 12 months
    expect(reminders[0]!.fireAt).toBe("2026-01-01");
    expect(reminders[0]!.message).toContain("6-month validity rule");
  });
});

// --- tracking orchestration ---
type TestDeps = TrackDeps & {
  repo: InMemoryTrackingRepo;
  notifications: InMemoryNotificationScheduler;
  email: InMemoryEmailReminderRegistry;
};

function makeDeps(over: Partial<TrackDeps> = {}): TestDeps {
  const clock = { now: () => new Date("2026-06-01T00:00:00.000Z") };
  const today = () => toIsoDate(clock.now());
  const repo = new InMemoryTrackingRepo();
  const notifications = new InMemoryNotificationScheduler(today);
  const email = new InMemoryEmailReminderRegistry();
  const deps = { ids: sequentialIdProvider, clock, repo, notifications, email, ...over };
  return deps as TestDeps;
}

describe("trackDocument", () => {
  let deps: ReturnType<typeof makeDeps>;
  beforeEach(() => { deps = makeDeps(); });

  it("tracks a tenancy, computes reminders, schedules future notifications", async () => {
    const res = await trackDocument(
      { docId: "d1", title: "Lekki Lease", docType: "tenancy_agreement", printedExpiry: "2027-01-01", source: "manual" },
      deps
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.tracked.effectiveExpiry).toBe("2027-01-01"); // tenancy: effective = printed
    expect(res.tracked.reminders).toHaveLength(4); // 90/60/30/0
    expect(deps.notifications.activeCount).toBe(4); // all future
  });

  it("refuses non-expiring types and invalid dates", async () => {
    expect((await trackDocument({ docId: "x", title: "NIN", docType: "nin" as any, printedExpiry: "2027-01-01", source: "manual" }, deps)).ok).toBe(false);
    const bad = await trackDocument({ docId: "y", title: "x", docType: "tenancy_agreement", printedExpiry: "not-a-date", source: "manual" }, deps);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe("invalid_date");
  });

  it("low extraction confidence asks for manual confirmation (REQ-EXPIRY-003)", async () => {
    const res = await trackDocument(
      { docId: "d", title: "Passport", docType: "international_passport", printedExpiry: "2027-01-01", source: "extracted", confidence: 0.4 },
      deps
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("needs_manual_confirmation");
  });

  it("enforces the free-tier 5-doc cap", async () => {
    const capped = makeDeps({ maxTracked: 2 });
    await trackDocument({ docId: "a", title: "a", docType: "tenancy_agreement", printedExpiry: "2027-01-01", source: "manual" }, capped);
    await trackDocument({ docId: "b", title: "b", docType: "tenancy_agreement", printedExpiry: "2027-01-01", source: "manual" }, capped);
    const third = await trackDocument({ docId: "c", title: "c", docType: "tenancy_agreement", printedExpiry: "2027-01-01", source: "manual" }, capped);
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.reason).toBe("limit_reached");
  });

  it("adds a validation-mode early reminder (DECISIONS #4)", async () => {
    const d = makeDeps({ validationEarlyDays: 1 });
    const res = await trackDocument({ docId: "d", title: "x", docType: "tenancy_agreement", printedExpiry: "2027-01-01", source: "manual" }, d);
    if (!res.ok) throw new Error("track failed");
    const early = res.tracked.reminders.find((r) => r.kind === "validation_early");
    expect(early?.fireAt).toBe("2026-06-02");
  });

  it("registers opt-in email reminders with label + fireAt only", async () => {
    const d = makeDeps({ emailEnabled: true });
    await trackDocument({ docId: "d", title: "My Lease", docType: "tenancy_agreement", printedExpiry: "2027-01-01", source: "manual" }, d);
    expect(d.email.rows.length).toBe(4);
    expect(d.email.rows[0]).toMatchObject({ docId: "d", label: "My Lease" });
  });
});

describe("reminder lifecycle", () => {
  let deps: ReturnType<typeof makeDeps>;
  beforeEach(() => { deps = makeDeps(); });

  it("dismiss one keeps the rest and cancels just that notification (REQ-EXPIRY-008)", async () => {
    const res = await trackDocument({ docId: "d", title: "x", docType: "tenancy_agreement", printedExpiry: "2027-01-01", source: "manual" }, deps);
    if (!res.ok) throw new Error("track failed");
    const before = deps.notifications.activeCount;
    const target = res.tracked.reminders[0]!;
    const after = await dismissReminder("d", target.id, deps);
    expect(after!.reminders.find((r) => r.id === target.id)!.dismissed).toBe(true);
    expect(after!.reminders.filter((r) => r.dismissed).length).toBe(1);
    expect(deps.notifications.activeCount).toBe(before - 1);
  });

  it("updateExpiry reschedules against the new date", async () => {
    await trackDocument({ docId: "d", title: "x", docType: "international_passport", printedExpiry: "2027-01-01", source: "manual" }, deps);
    const res = await updateExpiry("d", "2030-01-01", deps);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.tracked.effectiveExpiry).toBe("2029-07-01");
  });

  it("markReplaced cancels all notifications and flags replaced (REQ-EXPIRY-013)", async () => {
    await trackDocument({ docId: "d", title: "x", docType: "tenancy_agreement", printedExpiry: "2027-01-01", source: "manual" }, deps);
    const doc = await markReplaced("d", deps);
    expect(doc!.replaced).toBe(true);
    expect(deps.notifications.activeCount).toBe(0);
  });
});

describe("urgency bands", () => {
  const today = "2026-06-01";
  it("maps days-left to bands/colours", () => {
    expect(urgencyFor("2026-09-01", today).band).toBe("healthy");
    expect(urgencyFor("2026-06-20", today).band).toBe("soon");
    expect(urgencyFor("2026-06-05", today).colour).toBe("red");
    expect(urgencyFor("2026-05-01", today)).toMatchObject({ band: "expired", colour: "grey" });
  });
});

describe("travel-readiness", () => {
  const trip = "2026-09-01";
  function passport(printed: string): TrackedDocument {
    return {
      docId: "p", title: "Passport", docType: "international_passport",
      printedExpiry: printed, effectiveExpiry: subtractOffset(printed, { months: 6 }),
      policyVersion: 1, reminders: [], source: "manual", replaced: false,
      createdAt: "", updatedAt: "",
    };
  }

  it("flags a passport that fails the 6-month rule for the trip (the headline scenario)", () => {
    // printed expiry Oct 2026 -> effective Apr 2026, already past the Sep trip's 6-month need
    const r = travelReadiness([passport("2026-10-15")], trip);
    expect(r.ready).toBe(false);
    expect(r.issues[0]!.severity).toBe("blocker");
    expect(r.issues[0]!.message).toContain("6-month validity rule");
  });

  it("passes when the passport is comfortably valid", () => {
    const r = travelReadiness([passport("2030-01-01")], trip);
    expect(r.ready).toBe(true);
    expect(r.issues).toHaveLength(0);
  });
});

describe("renewal guidance (REQ-EXPIRY-014)", () => {
  it("points passports at the NIS", () => {
    expect(guidanceFor("international_passport").authority).toContain("Nigeria Immigration Service");
    expect(guidanceFor("drivers_vehicle_licence").authority).toContain("FRSC");
  });
});
