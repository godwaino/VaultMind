/**
 * Supabase-backed implementations of the AuthProvider and ProfileStore ports.
 * Lives behind the same interfaces the in-memory test fakes implement, so the
 * register logic stays framework-agnostic.
 */

import {
  DuplicateEmailError,
  type AuthProvider,
  type ProfileStore,
} from "../ports.js";
import { getSupabaseAdmin } from "./admin.js";

export const supabaseAuthProvider: AuthProvider = {
  async createUser({ email, password }) {
    const { data, error } = await getSupabaseAdmin().auth.admin.createUser({
      email,
      password,
      email_confirm: false,
    });
    if (error) {
      // Supabase surfaces duplicates as "User already registered" (status 422).
      const msg = error.message ?? "";
      if (/already.*registered|already.*exists/i.test(msg)) {
        throw new DuplicateEmailError();
      }
      throw error;
    }
    if (!data.user) {
      throw new Error("Supabase createUser returned no user");
    }
    return { userId: data.user.id };
  },
};

export const supabaseProfileStore: ProfileStore = {
  async insertProfile({ userId, email, phoneE164, ndpaConsents }) {
    const { error } = await getSupabaseAdmin()
      .from("profiles")
      .insert({
        user_id: userId,
        email,
        phone_e164: phoneE164,
        ndpa_consents: ndpaConsents,
      });
    if (error) throw error;
  },
};
