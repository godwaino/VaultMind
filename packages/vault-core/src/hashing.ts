/**
 * Content hashing for duplicate detection (REQ-VAULT-005). SHA-256 over the
 * original bytes. Done on-device; the hash is metadata, not content.
 */

import { sha256 } from "@noble/hashes/sha2";

export function sha256Hex(bytes: Uint8Array): string {
  const digest = sha256(bytes);
  let hex = "";
  for (let i = 0; i < digest.length; i++) hex += digest[i]!.toString(16).padStart(2, "0");
  return hex;
}

/** True if a document with this content hash already exists (caller supplies the set). */
export function isDuplicate(contentHash: string, existingHashes: ReadonlySet<string>): boolean {
  return existingHashes.has(contentHash);
}
