/**
 * @vaultmind/backup-core — opt-in, zero-knowledge cloud backup (REQ-VAULT-023..027,
 * DECISIONS #1). Each item is encrypted client-side under the Backup Master Key
 * (BMK), which the device holds via the Phase-0 backup keyset (password OR recovery
 * phrase unlocks it). The server only ever sees ciphertext + an opaque manifest, so
 * it cannot read backups. Free tier includes up to 5 GB.
 *
 * Transport (signed-URL upload/download to Supabase Storage) is injected via a port.
 */

import { aesGcmEncrypt, aesGcmDecrypt, utf8ToBytes } from "@vaultmind/crypto";

/** Free tier: 5 GB of encrypted backup (DECISIONS #1). Paid raises this. */
export const FREE_TIER_BACKUP_BYTES = 5 * 1024 * 1024 * 1024;

export const BACKUP_MANIFEST_VERSION = 1;

export interface BackupItem {
  docId: string;
  /** plaintext bytes to back up (already the vault's encrypted blob, or an export) */
  bytes: Uint8Array;
}

export interface BackupEntry {
  docId: string;
  blobKey: string;
  cipherBytes: number;
}

export interface BackupManifest {
  version: number;
  createdAt: string;
  entryCount: number;
  totalCipherBytes: number;
  entries: BackupEntry[];
}

export interface BackupTransport {
  upload(key: string, bytes: Uint8Array): Promise<void>;
  download(key: string): Promise<Uint8Array>;
  list(prefix: string): Promise<string[]>;
  remove(key: string): Promise<void>;
}

export class BackupCapExceededError extends Error {
  constructor(public readonly attempted: number, public readonly cap: number) {
    super(`Backup would use ${attempted} bytes, over the ${cap}-byte limit.`);
    this.name = "BackupCapExceededError";
  }
}

function blobKey(userId: string, docId: string): string {
  return `${userId}/${docId}.enc`;
}

const MANIFEST_AAD = utf8ToBytes("vaultmind/backup-manifest/v1");

/**
 * Encrypt items under the BMK and produce a manifest + the ciphertext blobs.
 * Enforces the backup-size cap on the resulting ciphertext.
 */
export async function buildBackup(
  userId: string,
  items: BackupItem[],
  bmk: Uint8Array,
  opts: { createdAt: string; maxBytes?: number }
): Promise<{ manifest: BackupManifest; blobs: Map<string, Uint8Array> }> {
  const blobs = new Map<string, Uint8Array>();
  const entries: BackupEntry[] = [];
  let total = 0;

  for (const item of items) {
    const cipher = await aesGcmEncrypt(bmk, item.bytes, utf8ToBytes(`backup:${item.docId}`));
    const key = blobKey(userId, item.docId);
    blobs.set(key, cipher);
    entries.push({ docId: item.docId, blobKey: key, cipherBytes: cipher.length });
    total += cipher.length;
  }

  const cap = opts.maxBytes ?? FREE_TIER_BACKUP_BYTES;
  if (total > cap) throw new BackupCapExceededError(total, cap);

  const manifest: BackupManifest = {
    version: BACKUP_MANIFEST_VERSION,
    createdAt: opts.createdAt,
    entryCount: entries.length,
    totalCipherBytes: total,
    entries,
  };
  return { manifest, blobs };
}

/** Upload all blobs + the manifest via the transport (REQ-VAULT-023). */
export async function runBackup(
  userId: string,
  items: BackupItem[],
  bmk: Uint8Array,
  transport: BackupTransport,
  opts: { createdAt: string; maxBytes?: number }
): Promise<BackupManifest> {
  const { manifest, blobs } = await buildBackup(userId, items, bmk, opts);
  for (const [key, bytes] of blobs) await transport.upload(key, bytes);
  const manifestBytes = await aesGcmEncrypt(bmk, utf8ToBytes(JSON.stringify(manifest)), MANIFEST_AAD);
  await transport.upload(`${userId}/manifest.json.enc`, manifestBytes);
  return manifest;
}

/** Download + decrypt a backup (REQ-VAULT-026 restore). */
export async function restoreBackup(
  userId: string,
  manifest: BackupManifest,
  bmk: Uint8Array,
  transport: BackupTransport
): Promise<BackupItem[]> {
  const items: BackupItem[] = [];
  for (const entry of manifest.entries) {
    const cipher = await transport.download(entry.blobKey);
    const bytes = await aesGcmDecrypt(bmk, cipher, utf8ToBytes(`backup:${entry.docId}`));
    items.push({ docId: entry.docId, bytes });
  }
  return items;
}

/** Read + decrypt the stored manifest. */
export async function fetchManifest(
  userId: string,
  bmk: Uint8Array,
  transport: BackupTransport
): Promise<BackupManifest> {
  const cipher = await transport.download(`${userId}/manifest.json.enc`);
  const json = await aesGcmDecrypt(bmk, cipher, MANIFEST_AAD);
  return JSON.parse(new TextDecoder().decode(json)) as BackupManifest;
}

/** Remote wipe: delete every backup object for a user (REQ-VAULT-027). */
export async function remoteWipe(userId: string, transport: BackupTransport): Promise<number> {
  const keys = await transport.list(`${userId}/`);
  for (const key of keys) await transport.remove(key);
  return keys.length;
}
