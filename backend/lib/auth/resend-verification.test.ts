import { describe, it, expect } from "vitest";
import { handleResendVerification } from "./resend-verification.js";

function fakes() {
  const calls: string[] = [];
  return {
    auth: {
      async resendVerification(email: string) {
        calls.push(email);
      },
    },
    calls,
  };
}

describe("handleResendVerification", () => {
  it("resends for a valid, normalised email", async () => {
    const f = fakes();
    const res = await handleResendVerification({ email: " Godwin@Example.com " }, f);
    expect(res.status).toBe(200);
    if (res.status === 200) expect(res.body).toEqual({ sent: true });
    expect(f.calls).toEqual(["godwin@example.com"]);
  });

  it("rejects an invalid email with a 400 and does not call the provider", async () => {
    const f = fakes();
    const res = await handleResendVerification({ email: "not-an-email" }, f);
    expect(res.status).toBe(400);
    expect(f.calls).toHaveLength(0);
  });

  it("reports success even if the account doesn't exist or is already confirmed (no enumeration)", async () => {
    const f = fakes();
    const res = await handleResendVerification({ email: "nobody@example.com" }, f);
    expect(res.status).toBe(200);
    expect(f.calls).toEqual(["nobody@example.com"]);
  });
});
