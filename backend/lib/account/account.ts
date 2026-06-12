/**
 * Account data export (NFR-SEC-008) and erasure (NFR-SEC-007). DSR endpoints are
 * API-first so support never touches user data by hand (ARCHITECTURE §8). Note: the
 * substance of a user's data lives on-device and inside opaque encrypted backups —
 * the server can only export/erase what it holds (account, billing, consents,
 * ciphertext). The device exports its own vault locally.
 */

export interface ServerHeldData {
  profile: { userId: string; email: string; phoneE164?: string; createdAt: string };
  entitlement: { tier: string; currentPeriodEnd?: string } | null;
  consentEvents: { consentKey: string; granted: boolean; at: string }[];
  backupManifestMeta: { version: number; createdAt: string; totalCipherBytes: number } | null;
}

export interface ExportBundle {
  exportedAt: string;
  account: ServerHeldData["profile"];
  entitlement: ServerHeldData["entitlement"];
  consents: ServerHeldData["consentEvents"];
  backups: ServerHeldData["backupManifestMeta"];
  note: string;
}

export function assembleExport(data: ServerHeldData, now: () => Date): ExportBundle {
  return {
    exportedAt: now().toISOString(),
    account: data.profile,
    entitlement: data.entitlement,
    consents: data.consentEvents,
    backups: data.backupManifestMeta,
    note:
      "This export covers data held on VaultMind servers. Your documents, OCR text, " +
      "categories, and expiry dates are stored only on your device (and, if you enabled " +
      "backup, as encrypted blobs we cannot read). Export those from the app's Settings.",
  };
}

// --- erasure ---

export const PURGE_ROWS_HOURS = 24; // NFR-SEC-007
export const PURGE_BLOBS_HOURS = 72;

export interface PurgeDeadlines {
  rowsBy: string;
  blobsBy: string;
}

function addHoursIso(fromIso: string, hours: number): string {
  return new Date(new Date(fromIso).getTime() + hours * 3600_000).toISOString();
}

export function purgeDeadlines(now: () => Date): PurgeDeadlines {
  const nowIso = now().toISOString();
  return {
    rowsBy: addHoursIso(nowIso, PURGE_ROWS_HOURS),
    blobsBy: addHoursIso(nowIso, PURGE_BLOBS_HOURS),
  };
}

export interface ErasurePorts {
  markProfileDeleted(userId: string, at: string): Promise<void>;
  schedulePurge(input: { userId: string; kind: "rows" | "blobs"; dueAt: string }): Promise<void>;
  audit(event: { userId: string; event: string; at: string }): Promise<void>;
}

export interface ErasureResult {
  userId: string;
  deletedAt: string;
  deadlines: PurgeDeadlines;
}

/** One-tap account erasure (REQ from §4.1 /api/account/delete). */
export async function requestErasure(
  userId: string,
  deps: ErasurePorts & { now: () => Date }
): Promise<ErasureResult> {
  const nowIso = deps.now().toISOString();
  const deadlines = purgeDeadlines(deps.now);

  await deps.markProfileDeleted(userId, nowIso);
  await deps.schedulePurge({ userId, kind: "rows", dueAt: deadlines.rowsBy });
  await deps.schedulePurge({ userId, kind: "blobs", dueAt: deadlines.blobsBy });
  await deps.audit({ userId, event: "account_erasure_requested", at: nowIso });

  return { userId, deletedAt: nowIso, deadlines };
}
