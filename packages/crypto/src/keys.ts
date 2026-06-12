/**
 * Local key hierarchy (ARCHITECTURE §3.2).
 *
 *   Device random ──► LMK (Local Master Key)   — lives in Keychain/Keystore
 *   LMK ──wraps──►   per-file DEKs + SQLite DB key
 *
 * The LMK is generated on the device and stored by the app in hardware-backed
 * secure storage (react-native-encrypted-storage). This module is storage-agnostic:
 * it generates keys and wraps/unwraps them; the app supplies persistence.
 */

import { randomBytes } from "./random.js";
import { aesGcmEncrypt, aesGcmDecrypt } from "./aesgcm.js";
import { utf8ToBytes } from "./encoding.js";

/** 256-bit symmetric key. */
export function generateKey(): Uint8Array {
  return randomBytes(32);
}

export const generateLocalMasterKey = generateKey;
export const generateDataEncryptionKey = generateKey;

/** Wrap (encrypt) a key with a wrapping key, binding a purpose label as AAD. */
export async function wrapKey(
  wrappingKey: Uint8Array,
  keyToWrap: Uint8Array,
  purpose: string
): Promise<Uint8Array> {
  return aesGcmEncrypt(wrappingKey, keyToWrap, utf8ToBytes(`wrap:${purpose}`));
}

export async function unwrapKey(
  wrappingKey: Uint8Array,
  wrapped: Uint8Array,
  purpose: string
): Promise<Uint8Array> {
  return aesGcmDecrypt(wrappingKey, wrapped, utf8ToBytes(`wrap:${purpose}`));
}

/**
 * Encrypted file = random DEK encrypts the bytes; the DEK is wrapped by the LMK.
 * Storing a per-file DEK is what makes crypto-shredding cheap: destroy the wrapped
 * DEK and the file is unrecoverable, no need to rewrite the (large) ciphertext
 * (REQ-VAULT-020 deletion / NFR-SEC-007 erasure).
 */
export interface EncryptedFile {
  /** DEK wrapped by the LMK */
  wrappedDek: Uint8Array;
  /** file bytes encrypted under the DEK */
  ciphertext: Uint8Array;
}

export async function encryptFile(
  lmk: Uint8Array,
  plaintext: Uint8Array,
  fileId: string
): Promise<EncryptedFile> {
  const dek = generateDataEncryptionKey();
  const ciphertext = await aesGcmEncrypt(dek, plaintext, utf8ToBytes(`file:${fileId}`));
  const wrappedDek = await wrapKey(lmk, dek, `file-dek:${fileId}`);
  return { wrappedDek, ciphertext };
}

export async function decryptFile(
  lmk: Uint8Array,
  file: EncryptedFile,
  fileId: string
): Promise<Uint8Array> {
  const dek = await unwrapKey(lmk, file.wrappedDek, `file-dek:${fileId}`);
  return aesGcmDecrypt(dek, file.ciphertext, utf8ToBytes(`file:${fileId}`));
}
