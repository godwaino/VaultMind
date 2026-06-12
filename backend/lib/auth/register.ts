/**
 * Registration logic (REQ-AUTH-001..003): validate input, create the auth user
 * (verification email gated), seed the profile with default NDPA consents.
 * Framework-agnostic and pure-ish (all I/O is injected), so it is fully unit-tested.
 */

import {
  validateEmail,
  validatePassword,
  normalizeNigerianPhone,
} from "@vaultmind/validation";
import type { ConsentKey } from "@vaultmind/consent";
import { DuplicateEmailError, type AuthProvider, type ProfileStore } from "../ports.js";

export interface RegisterRequest {
  email: string;
  password: string;
  phone: string;
  /** consents captured on the onboarding Consent Centre (REQ-ONB-002) */
  consents?: Partial<Record<ConsentKey, boolean>>;
}

export type RegisterResponse =
  | { status: 201; body: { userId: string; emailVerificationRequired: true } }
  | { status: 400; body: { errors: string[] } }
  | { status: 409; body: { errors: string[] } };

export interface RegisterDeps {
  auth: AuthProvider;
  profiles: ProfileStore;
}

// core_processing must be granted to use the app at all; everything else defaults off.
function defaultConsents(overrides?: Partial<Record<ConsentKey, boolean>>): Record<string, boolean> {
  return {
    core_processing: true,
    analytics: false,
    cloud_ocr_fallback: false,
    cloud_backup: false,
    tier2_ai: false,
    ...overrides,
  };
}

export async function handleRegister(
  req: RegisterRequest,
  deps: RegisterDeps
): Promise<RegisterResponse> {
  const errors: string[] = [];

  const email = validateEmail(req.email ?? "");
  if (!email.ok) errors.push(...email.errors);

  const password = validatePassword(req.password ?? "");
  if (!password.ok) errors.push(...password.errors);

  const phone = normalizeNigerianPhone(req.phone ?? "");
  if (!phone.ok) errors.push(...phone.errors);

  if (!email.ok || !password.ok || !phone.ok) {
    return { status: 400, body: { errors } };
  }

  // core_processing consent is mandatory to register (REQ-ONB-002).
  if (req.consents && req.consents.core_processing === false) {
    return {
      status: 400,
      body: { errors: ["Core processing consent is required to create an account."] },
    };
  }

  try {
    const { userId } = await deps.auth.createUser({
      email: email.value,
      password: password.value,
      phoneE164: phone.value,
    });
    await deps.profiles.insertProfile({
      userId,
      email: email.value,
      phoneE164: phone.value,
      ndpaConsents: defaultConsents(req.consents),
    });
    return { status: 201, body: { userId, emailVerificationRequired: true } };
  } catch (e) {
    if (e instanceof DuplicateEmailError) {
      return { status: 409, body: { errors: ["An account with this email already exists."] } };
    }
    throw e;
  }
}
