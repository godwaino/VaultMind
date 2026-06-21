import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST as registerPOST } from "./auth/register/route.js";
import { POST as analyzePOST } from "./contractscan/analyze/route.js";
import { POST as webhookPOST } from "./billing/webhook/route.js";
import { POST as exportPOST } from "./account/export/route.js";
import { POST as deletePOST } from "./account/delete/route.js";
import { GET as healthGET } from "./health/route.js";

// Ensure integration env is unset so we exercise the "not configured" path.
const ENV_KEYS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "GEMINI_API_KEY", "PAYSTACK_SECRET_KEY"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function jsonReq(url: string, body: unknown): Request {
  return new Request(url, { method: "POST", body: JSON.stringify(body) });
}

describe("routes degrade gracefully when unconfigured (501, not 500)", () => {
  it("register → 501 without Supabase env", async () => {
    const res = await registerPOST(jsonReq("http://x/api/auth/register", { email: "a@b.com" }));
    expect(res.status).toBe(501);
    expect(((await res.json()) as { error: string }).error).toBe("not_configured");
  });

  it("contractscan analyze → 501 without Gemini/Supabase env", async () => {
    const res = await analyzePOST(jsonReq("http://x/api/contractscan/analyze", {}));
    expect(res.status).toBe(501);
  });

  it("billing webhook → 501 without Paystack secret", async () => {
    const res = await webhookPOST(jsonReq("http://x/api/billing/webhook", { event: "charge.success" }));
    expect(res.status).toBe(501);
  });

  it("account export → 501 without Supabase env", async () => {
    const res = await exportPOST(jsonReq("http://x/api/account/export", { userId: "u1" }));
    expect(res.status).toBe(501);
  });

  it("account delete → 501 without Supabase env", async () => {
    const res = await deletePOST(jsonReq("http://x/api/account/delete", { userId: "u1" }));
    expect(res.status).toBe(501);
  });
});

describe("health", () => {
  it("returns 200 and reports configured integrations as booleans", async () => {
    const res = await healthGET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; configured: Record<string, boolean> };
    expect(body.status).toBe("ok");
    expect(body.configured).toMatchObject({ supabase: false, gemini: false, paystack: false });
  });
});
