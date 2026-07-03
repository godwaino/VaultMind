/**
 * Resend-verification logic (REQ-AUTH-001..003 follow-up): lets a user whose
 * original signup verification email never arrived get a fresh one, without
 * needing to re-register (which just fails with "already exists") or being
 * permanently locked out. Framework-agnostic, mirrors lib/auth/register.ts.
 */

import { validateEmail } from "@vaultmind/validation";
import type { AuthProvider } from "../ports.js";

export interface ResendVerificationRequest {
  email: string;
}

export type ResendVerificationResponse =
  | { status: 200; body: { sent: true } }
  | { status: 400; body: { errors: string[] } };

export interface ResendVerificationDeps {
  auth: Pick<AuthProvider, "resendVerification">;
}

export async function handleResendVerification(
  req: ResendVerificationRequest,
  deps: ResendVerificationDeps
): Promise<ResendVerificationResponse> {
  const email = validateEmail(req.email ?? "");
  if (!email.ok) return { status: 400, body: { errors: email.errors } };

  // Always report success regardless of whether the account exists or is
  // already confirmed, so this endpoint can't be used to enumerate accounts.
  await deps.auth.resendVerification(email.value);
  return { status: 200, body: { sent: true } };
}
