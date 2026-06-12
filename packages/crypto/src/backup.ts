/**
 * Zero-knowledge cloud backup keyset (DECISIONS.md #1 + #2, ARCHITECTURE §3.2).
 *
 * One random Backup Master Key (BMK) actually encrypts backup blobs. The BMK is
 * wrapped TWO independent ways so either unlocks it:
 *
 *   1. password path : KEK = Argon2id(password, salt)  ── wraps ──► BMK
 *   2. recovery path : recoveryKey = HKDF(mnemonic)     ── wraps ──► BMK
 *
 * The server stores ONLY the wrapped BMKs + salt + KDF params (all opaque). It
 * never sees the password, the mnemonic, or the BMK — so it is zero-knowledge
 * (NFR-SEC-003). Forgetting the password no longer means losing the backup: the
 * 24-word recovery phrase re-derives recoveryKey, unwraps the BMK, and restores.
 *
 * The recovery phrase is returned exactly once (to show the user) and never stored.
 */

import { generateMnemonic, mnemonicToEntropy, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha2";
import { randomBytes } from "./random.js";
import { deriveKey, DEFAULT_ARGON2_PARAMS, type Argon2Params } from "./kdf.js";
import { wrapKey, unwrapKey } from "./keys.js";
import { utf8ToBytes } from "./encoding.js";

/** Persisted, server-stored, fully opaque. No plaintext, no key material. */
export interface BackupKeyset {
  version: 1;
  salt: Uint8Array;
  argon: Argon2Params;
  /** BMK wrapped by the password-derived KEK */
  bmkByPassword: Uint8Array;
  /** BMK wrapped by the recovery-phrase-derived key */
  bmkByRecovery: Uint8Array;
}

export interface NewBackupKeyset {
  keyset: BackupKeyset;
  /** show ONCE, require user to save; never persisted by us */
  recoveryPhrase: string;
  /** the live BMK for this session (use to encrypt/decrypt blobs now) */
  bmk: Uint8Array;
}

const RECOVERY_INFO = utf8ToBytes("vaultmind/backup-recovery-key/v1");

/** Derive the 32-byte recovery key from a BIP39 mnemonic (domain-separated). */
export function recoveryKeyFromPhrase(phrase: string): Uint8Array {
  const normalized = phrase.trim().replace(/\s+/g, " ").toLowerCase();
  if (!validateMnemonic(normalized, wordlist)) {
    throw new Error("Invalid recovery phrase (checksum or word list mismatch)");
  }
  const entropy = mnemonicToEntropy(normalized, wordlist); // 32 bytes for 24 words
  return hkdf(sha256, entropy, undefined, RECOVERY_INFO, 32);
}

/** Enable backup: mint a fresh keyset + recovery phrase. */
export async function createBackupKeyset(
  password: string,
  argon: Argon2Params = DEFAULT_ARGON2_PARAMS
): Promise<NewBackupKeyset> {
  const bmk = randomBytes(32);
  const salt = randomBytes(16);
  const kek = deriveKey(password, salt, argon);

  const recoveryPhrase = generateMnemonic(wordlist, 256); // 24 words
  const recoveryKey = recoveryKeyFromPhrase(recoveryPhrase);

  const bmkByPassword = await wrapKey(kek, bmk, "bmk:password");
  const bmkByRecovery = await wrapKey(recoveryKey, bmk, "bmk:recovery");

  return {
    keyset: { version: 1, salt, argon, bmkByPassword, bmkByRecovery },
    recoveryPhrase,
    bmk,
  };
}

/** Normal unlock with the account password. */
export async function unlockWithPassword(
  keyset: BackupKeyset,
  password: string
): Promise<Uint8Array> {
  const kek = deriveKey(password, keyset.salt, keyset.argon);
  return unwrapKey(kek, keyset.bmkByPassword, "bmk:password");
}

/** Recovery unlock when the password is forgotten. */
export async function unlockWithRecoveryPhrase(
  keyset: BackupKeyset,
  phrase: string
): Promise<Uint8Array> {
  const recoveryKey = recoveryKeyFromPhrase(phrase);
  return unwrapKey(recoveryKey, keyset.bmkByRecovery, "bmk:recovery");
}

/**
 * After a recovery unlock the user sets a NEW password; re-wrap the BMK so the
 * password path works again. Recovery wrapping is unchanged (same phrase).
 */
export async function rewrapPassword(
  keyset: BackupKeyset,
  bmk: Uint8Array,
  newPassword: string,
  argon: Argon2Params = DEFAULT_ARGON2_PARAMS
): Promise<BackupKeyset> {
  const salt = randomBytes(16);
  const kek = deriveKey(newPassword, salt, argon);
  const bmkByPassword = await wrapKey(kek, bmk, "bmk:password");
  return { ...keyset, salt, argon, bmkByPassword };
}
