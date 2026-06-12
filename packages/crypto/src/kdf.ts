/**
 * Password-based key derivation for the backup KEK (ARCHITECTURE §3.2, NFR-SEC-003).
 *
 * Argon2id is the chosen KDF (memory-hard, resists GPU/ASIC cracking). The zero-
 * knowledge backup guarantee rests entirely on this: the server never sees the
 * password or the KEK, so a weak KDF would be the only attack surface on stolen
 * ciphertext.
 *
 * Parameters are stored alongside the ciphertext so they can be raised over time
 * without breaking old backups. Defaults target ~tens-to-hundreds of ms on a
 * mid-range 2022 Android — tune with the week-1 device benchmark.
 */

import { argon2id } from "@noble/hashes/argon2";
import { utf8ToBytes } from "./encoding.js";

export interface Argon2Params {
  /** memory cost in KiB */
  m: number;
  /** iterations (time cost) */
  t: number;
  /** parallelism */
  p: number;
}

export const DEFAULT_ARGON2_PARAMS: Argon2Params = { m: 64 * 1024, t: 3, p: 1 };

/** Derive a 32-byte key from a password + 16-byte salt. */
export function deriveKey(
  password: string,
  salt: Uint8Array,
  params: Argon2Params = DEFAULT_ARGON2_PARAMS
): Uint8Array {
  if (salt.length < 16) throw new Error("Salt must be at least 16 bytes");
  return argon2id(utf8ToBytes(password.normalize("NFKC")), salt, {
    m: params.m,
    t: params.t,
    p: params.p,
    dkLen: 32,
  });
}
