import { describe, it, expect } from "vitest";
import {
  validateEmail,
  validatePassword,
  normalizeNigerianPhone,
  SESSION_POLICY,
} from "./index.js";

describe("validateEmail", () => {
  it("accepts and lowercases a valid email", () => {
    const r = validateEmail("  Godwin.Sabo@Hotmail.com ");
    expect(r).toEqual({ ok: true, value: "godwin.sabo@hotmail.com" });
  });
  it.each(["no-at", "a@b", "a b@c.com", "@x.com", "x@y."])("rejects %s", (bad) => {
    expect(validateEmail(bad).ok).toBe(false);
  });
});

describe("validatePassword", () => {
  it("accepts a strong password", () => {
    expect(validatePassword("Vault!Mind99").ok).toBe(true);
  });
  it("collects every failing rule", () => {
    const r = validatePassword("weak");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.length).toBeGreaterThanOrEqual(4); // length, upper, digit, symbol
    }
  });
});

describe("normalizeNigerianPhone", () => {
  it.each([
    ["08031234567", "+2348031234567"],
    ["8031234567", "+2348031234567"],
    ["2348031234567", "+2348031234567"],
    ["+234 803 123 4567", "+2348031234567"],
    ["0703-123-4567", "+2347031234567"],
    ["0901 234 5678", "+2349012345678"],
  ])("normalises %s -> %s", (input, expected) => {
    expect(normalizeNigerianPhone(input)).toEqual({ ok: true, value: expected });
  });

  it.each([
    "0601234567", // NSN starts with 6 (not a mobile prefix)
    "080123456", // too short
    "080123456789", // too long
    "abc",
    "+1 415 555 0100", // not Nigerian
  ])("rejects %s", (bad) => {
    expect(normalizeNigerianPhone(bad).ok).toBe(false);
  });
});

describe("session policy", () => {
  it("encodes NFR-SEC-005", () => {
    expect(SESSION_POLICY.accessTokenTtlMinutes).toBe(15);
    expect(SESSION_POLICY.inactivityLogoutMinutes).toBe(30);
  });
});
