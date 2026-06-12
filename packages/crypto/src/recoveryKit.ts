/**
 * Recovery kit — the non-technical fallback to writing down 24 words
 * (DECISIONS.md #2). The user picks a passphrase; we export the recovery key as a
 * small encrypted file they can email to themselves or store in their own cloud.
 * Importing it (with the passphrase) yields the same recovery key, which unlocks
 * the backup keyset. Still zero-knowledge: we never hold the passphrase or the file.
 */

import { aesGcmEncrypt, aesGcmDecrypt } from "./aesgcm.js";
import { deriveKey, DEFAULT_ARGON2_PARAMS, type Argon2Params } from "./kdf.js";
import { randomBytes } from "./random.js";
import { toBase64, fromBase64, utf8ToBytes } from "./encoding.js";

interface RecoveryKitFile {
  v: 1;
  kind: "vaultmind-recovery-kit";
  salt: string; // base64
  argon: Argon2Params;
  blob: string; // base64 AES-GCM envelope of the recovery key
}

const AAD = utf8ToBytes("vaultmind/recovery-kit/v1");

export async function exportRecoveryKit(
  recoveryKey: Uint8Array,
  passphrase: string,
  argon: Argon2Params = DEFAULT_ARGON2_PARAMS
): Promise<string> {
  const salt = randomBytes(16);
  const wrapKeyBytes = deriveKey(passphrase, salt, argon);
  const blob = await aesGcmEncrypt(wrapKeyBytes, recoveryKey, AAD);
  const file: RecoveryKitFile = {
    v: 1,
    kind: "vaultmind-recovery-kit",
    salt: toBase64(salt),
    argon,
    blob: toBase64(blob),
  };
  return JSON.stringify(file);
}

export async function importRecoveryKit(
  fileJson: string,
  passphrase: string
): Promise<Uint8Array> {
  let file: RecoveryKitFile;
  try {
    file = JSON.parse(fileJson) as RecoveryKitFile;
  } catch {
    throw new Error("Recovery kit is not valid JSON");
  }
  if (file.kind !== "vaultmind-recovery-kit") throw new Error("Not a VaultMind recovery kit");
  const wrapKeyBytes = deriveKey(passphrase, fromBase64(file.salt), file.argon);
  return aesGcmDecrypt(wrapKeyBytes, fromBase64(file.blob), AAD);
}
