import { describe, it, expect } from "vitest";
import {
  assembleExport,
  requestErasure,
  purgeDeadlines,
  PURGE_ROWS_HOURS,
  PURGE_BLOBS_HOURS,
  type ServerHeldData,
  type ErasurePorts,
} from "./account.js";

const now = () => new Date("2026-06-15T12:00:00.000Z");

describe("account export", () => {
  it("bundles only server-held data and explains where the rest lives", () => {
    const data: ServerHeldData = {
      profile: { userId: "u1", email: "g@example.com", createdAt: "2026-01-01T00:00:00Z" },
      entitlement: { tier: "personal" },
      consentEvents: [{ consentKey: "cloud_backup", granted: true, at: "2026-02-01T00:00:00Z" }],
      backupManifestMeta: { version: 1, createdAt: "2026-06-01T00:00:00Z", totalCipherBytes: 1234 },
    };
    const bundle = assembleExport(data, now);
    expect(bundle.account.userId).toBe("u1");
    expect(bundle.consents).toHaveLength(1);
    expect(bundle.note.toLowerCase()).toContain("only on your device");
  });
});

describe("erasure", () => {
  it("computes 24h-rows / 72h-blobs purge deadlines (NFR-SEC-007)", () => {
    const d = purgeDeadlines(now);
    expect(d.rowsBy).toBe("2026-06-16T12:00:00.000Z"); // +24h
    expect(d.blobsBy).toBe("2026-06-18T12:00:00.000Z"); // +72h
    expect([PURGE_ROWS_HOURS, PURGE_BLOBS_HOURS]).toEqual([24, 72]);
  });

  it("marks the profile deleted, schedules both purges, and audits", async () => {
    const calls: string[] = [];
    const deps: ErasurePorts & { now: () => Date } = {
      now,
      async markProfileDeleted(userId) { calls.push(`deleted:${userId}`); },
      async schedulePurge({ kind }) { calls.push(`purge:${kind}`); },
      async audit({ event }) { calls.push(`audit:${event}`); },
    };
    const res = await requestErasure("u1", deps);
    expect(res.deletedAt).toBe("2026-06-15T12:00:00.000Z");
    expect(calls).toEqual([
      "deleted:u1",
      "purge:rows",
      "purge:blobs",
      "audit:account_erasure_requested",
    ]);
  });
});
