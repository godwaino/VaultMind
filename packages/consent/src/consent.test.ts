import { describe, it, expect } from "vitest";
import {
  ConsentRegistry,
  ConsentDeniedError,
  assertConsent,
  EGRESS_CONSENT_KEYS,
  type ConsentToken,
} from "./index.js";

function fixedClock() {
  let t = Date.parse("2026-01-01T00:00:00.000Z");
  return () => new Date((t += 1000));
}

// A stand-in egress function: it REQUIRES a token, so it cannot run without consent.
async function uploadEncryptedBackup(_blob: Uint8Array, token: ConsentToken): Promise<string> {
  assertConsent(token, "cloud_backup");
  return "uploaded";
}

describe("ConsentRegistry", () => {
  it("defaults to not granted", () => {
    const r = new ConsentRegistry({ appVersion: "1.0.0" });
    for (const k of EGRESS_CONSENT_KEYS) expect(r.isGranted(k)).toBe(false);
  });

  it("blocks token minting until granted", () => {
    const r = new ConsentRegistry({ appVersion: "1.0.0" });
    expect(() => r.mintToken("tier2_ai")).toThrow(ConsentDeniedError);
    r.grant("tier2_ai");
    expect(r.mintToken("tier2_ai").key).toBe("tier2_ai");
  });

  it("an egress function cannot run without a minted token", async () => {
    const r = new ConsentRegistry({ appVersion: "1.0.0" });
    expect(() => r.mintToken("cloud_backup")).toThrow(ConsentDeniedError);

    r.grant("cloud_backup");
    const token = r.mintToken("cloud_backup");
    await expect(uploadEncryptedBackup(new Uint8Array([1]), token)).resolves.toBe("uploaded");
  });

  it("a token for the wrong key is rejected by assertConsent", () => {
    const r = new ConsentRegistry({ appVersion: "1.0.0", initial: { tier2_ai: true } });
    const wrong = r.mintToken("tier2_ai");
    expect(() => assertConsent(wrong, "cloud_backup")).toThrow(ConsentDeniedError);
  });

  it("revoking blocks subsequent minting", () => {
    const r = new ConsentRegistry({ appVersion: "1.0.0", initial: { cloud_ocr_fallback: true } });
    expect(r.mintToken("cloud_ocr_fallback").key).toBe("cloud_ocr_fallback");
    r.revoke("cloud_ocr_fallback");
    expect(() => r.mintToken("cloud_ocr_fallback")).toThrow(ConsentDeniedError);
  });

  it("appends an audit event on every real change, with version + timestamp", () => {
    const r = new ConsentRegistry({ appVersion: "1.2.3", now: fixedClock() });
    r.grant("cloud_backup");
    r.grant("cloud_backup"); // no-op, no duplicate event
    r.revoke("cloud_backup");
    const events = r.getEvents();
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ consentKey: "cloud_backup", granted: true, appVersion: "1.2.3" });
    expect(events[1]).toMatchObject({ consentKey: "cloud_backup", granted: false });
    expect(events[0]!.at < events[1]!.at).toBe(true);
  });

  it("seeded initial state does not emit events (rehydration)", () => {
    const r = new ConsentRegistry({ appVersion: "1.0.0", initial: { analytics: true } });
    expect(r.isGranted("analytics")).toBe(true);
    expect(r.getEvents()).toHaveLength(0);
  });
});
