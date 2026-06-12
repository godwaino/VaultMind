/**
 * Ports (interfaces) the route handlers depend on. The real adapters wrap
 * @supabase/supabase-js (Auth + Postgres) with the SERVICE-ROLE key, which lives
 * only in Vercel env (ARCHITECTURE §5 "Secrets"). Keeping handlers behind these
 * interfaces means the business logic is unit-testable with in-memory fakes and
 * has no hard dependency on the network.
 */

export interface NewUser {
  email: string;
  password: string;
  phoneE164: string;
}

export class DuplicateEmailError extends Error {
  constructor() {
    super("email already registered");
    this.name = "DuplicateEmailError";
  }
}

export interface AuthProvider {
  /**
   * Create the auth user and trigger the verification email. Implemented by
   * Supabase Auth admin.createUser({ email_confirm: false }) + resend verification.
   * Throws DuplicateEmailError if the email already exists.
   */
  createUser(input: NewUser): Promise<{ userId: string }>;
}

export interface ProfileStore {
  /** Insert the profile row (RLS: user_id = auth.uid()). */
  insertProfile(input: {
    userId: string;
    email: string;
    phoneE164: string;
    ndpaConsents: Record<string, boolean>;
  }): Promise<void>;
}

export interface Clock {
  now(): Date;
}
