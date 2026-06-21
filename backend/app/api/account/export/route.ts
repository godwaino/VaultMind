/**
 * POST /api/account/export — DSR data export (NFR-SEC-008). Assembles the
 * server-held data for the authenticated user. (Device data is exported in-app.)
 * The user id comes from the verified JWT at the edge; passed in the body here for
 * the adapter wiring — replace with the verified subject in middleware.
 */

import { assembleExport, type ServerHeldData } from "../../../../lib/account/account.js";
import { missingEnv, notConfigured } from "../../../../lib/http.js";
import { supabaseAdmin } from "../../../../lib/adapters/supabase.js";

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

export async function POST(request: Request): Promise<Response> {
  const missing = missingEnv(REQUIRED_ENV);
  if (missing.length) return notConfigured(`Account export is not configured (missing ${missing.join(", ")}).`);

  let userId: string;
  try {
    ({ userId } = (await request.json()) as { userId: string });
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

  const sb = supabaseAdmin();
  const [profile, entitlement, consents, manifest] = await Promise.all([
    sb.from("profiles").select("user_id,email,phone_e164,created_at").eq("user_id", userId).maybeSingle(),
    sb.from("entitlements").select("tier,current_period_end").eq("user_id", userId).maybeSingle(),
    sb.from("consent_events").select("consent_key,granted,at").eq("user_id", userId),
    sb.from("backup_manifests").select("version,created_at,size_bytes").eq("user_id", userId).order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const data: ServerHeldData = {
    profile: {
      userId,
      email: (profile.data?.email as string) ?? "",
      ...(profile.data?.phone_e164 ? { phoneE164: profile.data.phone_e164 as string } : {}),
      createdAt: (profile.data?.created_at as string) ?? "",
    },
    entitlement: entitlement.data
      ? {
          tier: entitlement.data.tier as string,
          ...(entitlement.data.current_period_end ? { currentPeriodEnd: entitlement.data.current_period_end as string } : {}),
        }
      : null,
    consentEvents: (consents.data ?? []).map((c) => ({
      consentKey: c.consent_key as string,
      granted: c.granted as boolean,
      at: c.at as string,
    })),
    backupManifestMeta: manifest.data
      ? { version: manifest.data.version as number, createdAt: manifest.data.created_at as string, totalCipherBytes: manifest.data.size_bytes as number }
      : null,
  };

  return Response.json(assembleExport(data, () => new Date()));
}
