import { describe, it, expect } from "vitest";
import { handleRegister } from "./register.js";
import { DuplicateEmailError, type AuthProvider, type ProfileStore } from "../ports.js";

function fakes(opts: { duplicate?: boolean } = {}) {
  const inserted: unknown[] = [];
  const auth: AuthProvider = {
    async createUser() {
      if (opts.duplicate) throw new DuplicateEmailError();
      return { userId: "user-1" };
    },
  };
  const profiles: ProfileStore = {
    async insertProfile(p) {
      inserted.push(p);
    },
  };
  return { auth, profiles, inserted };
}

const valid = { email: "godwin@example.com", password: "Vault!Mind99", phone: "08031234567" };

describe("handleRegister", () => {
  it("registers a valid user, seeds default consents, requires verification", async () => {
    const f = fakes();
    const res = await handleRegister(valid, f);
    expect(res.status).toBe(201);
    if (res.status === 201) {
      expect(res.body).toEqual({ userId: "user-1", emailVerificationRequired: true });
    }
    expect(f.inserted).toHaveLength(1);
    expect(f.inserted[0]).toMatchObject({
      phoneE164: "+2348031234567",
      ndpaConsents: { core_processing: true, cloud_backup: false, tier2_ai: false },
    });
  });

  it("aggregates all validation errors with a 400", async () => {
    const res = await handleRegister({ email: "bad", password: "weak", phone: "123" }, fakes());
    expect(res.status).toBe(400);
    if (res.status === 400) expect(res.body.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects when core_processing consent is explicitly withheld", async () => {
    const res = await handleRegister({ ...valid, consents: { core_processing: false } }, fakes());
    expect(res.status).toBe(400);
  });

  it("maps a duplicate email to 409", async () => {
    const res = await handleRegister(valid, fakes({ duplicate: true }));
    expect(res.status).toBe(409);
  });

  it("honours opt-in consent overrides", async () => {
    const f = fakes();
    await handleRegister({ ...valid, consents: { cloud_backup: true } }, f);
    expect(f.inserted[0]).toMatchObject({ ndpaConsents: { cloud_backup: true } });
  });
});
