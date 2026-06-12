/**
 * @vaultmind/validation — shared input validation for auth (REQ-AUTH-001..005)
 * and session policy constants (NFR-SEC-005). Pure functions, no I/O, so they run
 * identically on the device and in the backend route handlers.
 */

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

// ---------------------------------------------------------------------------
// Email (REQ-AUTH-001)
// ---------------------------------------------------------------------------

// Pragmatic, not RFC-5322-exhaustive: one @, a dotted domain, no spaces.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(input: string): Result<string> {
  const email = input.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, errors: ["Enter a valid email address."] };
  if (email.length > 254) return { ok: false, errors: ["Email address is too long."] };
  return { ok: true, value: email };
}

// ---------------------------------------------------------------------------
// Password complexity (REQ-AUTH-002)
// ---------------------------------------------------------------------------

export interface PasswordPolicy {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireDigit: boolean;
  requireSymbol: boolean;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 10,
  requireUpper: true,
  requireLower: true,
  requireDigit: true,
  requireSymbol: true,
};

export function validatePassword(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY
): Result<string> {
  const errors: string[] = [];
  if (password.length < policy.minLength)
    errors.push(`Use at least ${policy.minLength} characters.`);
  if (policy.requireUpper && !/[A-Z]/.test(password)) errors.push("Add an uppercase letter.");
  if (policy.requireLower && !/[a-z]/.test(password)) errors.push("Add a lowercase letter.");
  if (policy.requireDigit && !/[0-9]/.test(password)) errors.push("Add a number.");
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) errors.push("Add a symbol.");
  return errors.length ? { ok: false, errors } : { ok: true, value: password };
}

// ---------------------------------------------------------------------------
// Nigerian phone -> E.164 (REQ-AUTH-001, used for SMS-OTP fallback)
// ---------------------------------------------------------------------------

/**
 * Accepts the formats Nigerians actually type and normalises to +234XXXXXXXXXX:
 *   08031234567, 8031234567, 2348031234567, +2348031234567, with spaces/dashes.
 * The 10-digit national significant number must start with 7, 8, or 9 (current
 * mobile network codes: 070x, 080x, 081x, 090x, 091x ...).
 */
export function normalizeNigerianPhone(input: string): Result<string> {
  const digits = input.replace(/[\s\-()]/g, "").replace(/^\+/, "");
  let nsn: string | null = null;

  if (/^234\d{10}$/.test(digits)) nsn = digits.slice(3);
  else if (/^0\d{10}$/.test(digits)) nsn = digits.slice(1);
  else if (/^\d{10}$/.test(digits)) nsn = digits;

  if (nsn === null) {
    return { ok: false, errors: ["Enter a valid Nigerian phone number, e.g. 0803 123 4567."] };
  }
  if (!/^[789]/.test(nsn)) {
    return { ok: false, errors: ["That doesn't look like a Nigerian mobile number."] };
  }
  return { ok: true, value: `+234${nsn}` };
}

// ---------------------------------------------------------------------------
// Session policy (NFR-SEC-005)
// ---------------------------------------------------------------------------

export const SESSION_POLICY = {
  accessTokenTtlMinutes: 15,
  inactivityLogoutMinutes: 30,
  refreshRotation: true,
} as const;
