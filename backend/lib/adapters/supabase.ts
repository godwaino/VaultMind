/**
 * Real Supabase adapters (service-role) implementing the backend ports. The service
 * key lives only in Vercel env (ARCHITECTURE §5). Server holds metadata + ciphertext
 * only (NFR-SEC-006). One client per request keeps things stateless for serverless.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DuplicateEmailError,
  type AuthProvider,
  type ProfileStore,
} from "../ports.js";
import type {
  AuditLog,
  EntitlementStore,
  Tier,
  UsageCounter,
} from "../contractscan/ports.js";
import type { EntitlementWriter, EntitlementUpdate } from "../billing/paystack.js";
import type { ErasurePorts } from "../account/account.js";
import { sendEmail } from "./resend.js";

export function supabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// --- Auth (REQ-AUTH-001..003) ---
export function makeAuthProvider(sb: SupabaseClient = supabaseAdmin()): AuthProvider {
  return {
    async createUser(input) {
      const { data, error } = await sb.auth.admin.createUser({
        email: input.email,
        password: input.password,
        phone: input.phoneE164,
        email_confirm: false, // user must verify
      });
      if (error) {
        if (/registered|already exists|duplicate/i.test(error.message)) {
          throw new DuplicateEmailError();
        }
        throw new Error(error.message);
      }
      const user = data.user;
      if (!user) throw new Error("Supabase returned no user");

      // Trigger the verification email via a signup link + Resend (best-effort).
      try {
        const { data: link } = await sb.auth.admin.generateLink({
          type: "signup",
          email: input.email,
          password: input.password,
        });
        const url = link?.properties?.action_link;
        if (url) {
          await sendEmail({
            to: input.email,
            subject: "Verify your VaultMind email",
            html: `<p>Welcome to VaultMind. Please verify your email:</p><p><a href="${url}">Verify my email</a></p>`,
          });
        }
      } catch {
        // verification email is best-effort here; a resend endpoint can retry
      }
      return { userId: user.id };
    },
  };
}

export function makeProfileStore(sb: SupabaseClient = supabaseAdmin()): ProfileStore {
  return {
    async insertProfile(input) {
      const { error } = await sb.from("profiles").insert({
        user_id: input.userId,
        email: input.email,
        phone_e164: input.phoneE164,
        ndpa_consents: input.ndpaConsents,
      });
      if (error) throw new Error(error.message);
    },
  };
}

// --- Entitlements (ARCHITECTURE §7) ---
export function makeEntitlementStore(sb: SupabaseClient = supabaseAdmin()): EntitlementStore {
  return {
    async getTier(userId) {
      const { data, error } = await sb
        .from("entitlements")
        .select("tier")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return ((data?.tier as Tier | undefined) ?? "free");
    },
  };
}

export function makeEntitlementWriter(sb: SupabaseClient = supabaseAdmin()): EntitlementWriter {
  return {
    async apply(u: EntitlementUpdate) {
      const row: Record<string, unknown> = { user_id: u.userId, tier: u.tier, updated_at: new Date().toISOString() };
      if (u.paystackCustomerId) row.paystack_customer_id = u.paystackCustomerId;
      if (u.paystackSubId) row.paystack_sub_id = u.paystackSubId;
      if (u.currentPeriodEnd) row.current_period_end = u.currentPeriodEnd;
      if (u.earlyAccessLockUntil) row.early_access_lock_until = u.earlyAccessLockUntil;
      const { error } = await sb.from("entitlements").upsert(row, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
    },
  };
}

// --- Usage counter (REQ-CONTRACT-012) ---
export function makeUsageCounter(sb: SupabaseClient = supabaseAdmin()): UsageCounter {
  return {
    async get(userId, metric, period) {
      const { data, error } = await sb
        .from("usage_counters")
        .select("count")
        .eq("user_id", userId)
        .eq("metric", metric)
        .eq("period", period)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data?.count as number | undefined) ?? 0;
    },
    async increment(userId, metric, period) {
      const { error } = await sb.rpc("increment_usage_counter", {
        p_user: userId,
        p_metric: metric,
        p_period: period,
      });
      if (error) throw new Error(error.message);
    },
  };
}

// --- Audit log (content-free) ---
export function makeAuditLog(sb: SupabaseClient = supabaseAdmin()): AuditLog {
  return {
    async record(event) {
      const { error } = await sb.from("audit_log").insert({
        user_id: event.userId,
        event: event.event,
        at: event.at,
      });
      if (error) throw new Error(error.message);
    },
  };
}

// --- Erasure (NFR-SEC-007) ---
export function makeErasurePorts(sb: SupabaseClient = supabaseAdmin()): ErasurePorts {
  return {
    async markProfileDeleted(userId, at) {
      const { error } = await sb.from("profiles").update({ deleted_at: at }).eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
    async schedulePurge({ userId, kind, dueAt }) {
      const { error } = await sb.from("purge_jobs").insert({ user_id: userId, kind, due_at: dueAt });
      if (error) throw new Error(error.message);
    },
    async audit({ userId, event, at }) {
      const { error } = await sb.from("audit_log").insert({ user_id: userId, event, at });
      if (error) throw new Error(error.message);
    },
  };
}

// --- Backup signed URLs (REQ-VAULT-023/026) — used by /api/backup/* ---
export function makeBackupStorage(sb: SupabaseClient = supabaseAdmin()) {
  const bucket = "backups";
  return {
    async signedUpload(userId: string, key: string) {
      const path = `${userId}/${key}`;
      const { data, error } = await sb.storage.from(bucket).createSignedUploadUrl(path);
      if (error) throw new Error(error.message);
      return data;
    },
    async signedDownload(userId: string, key: string, expiresIn = 300) {
      const path = `${userId}/${key}`;
      const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, expiresIn);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    },
    async remoteWipe(userId: string) {
      const { data: list, error: listErr } = await sb.storage.from(bucket).list(userId);
      if (listErr) throw new Error(listErr.message);
      const paths = (list ?? []).map((f) => `${userId}/${f.name}`);
      if (paths.length) {
        const { error } = await sb.storage.from(bucket).remove(paths);
        if (error) throw new Error(error.message);
      }
      return paths.length;
    },
  };
}
