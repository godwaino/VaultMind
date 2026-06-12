import { describe, it, expect } from "vitest";
import {
  aesGcmEncrypt,
  aesGcmDecrypt,
  deriveKey,
  generateLocalMasterKey,
  encryptFile,
  decryptFile,
  createBackupKeyset,
  unlockWithPassword,
  unlockWithRecoveryPhrase,
  rewrapPassword,
  exportRecoveryKit,
  importRecoveryKit,
  recoveryKeyFromPhrase,
  randomBytes,
  utf8ToBytes,
  bytesToUtf8,
  timingSafeEqual,
} from "./index.js";

// Keep Argon2 cheap in tests; production uses DEFAULT_ARGON2_PARAMS.
const FAST = { m: 8 * 1024, t: 1, p: 1 };

describe("AES-256-GCM envelope", () => {
  it("round-trips plaintext", async () => {
    const key = randomBytes(32);
    const msg = utf8ToBytes("my passport scan bytes");
    const env = await aesGcmEncrypt(key, msg);
    expect(bytesToUtf8(await aesGcmDecrypt(key, env))).toBe("my passport scan bytes");
  });

  it("fails the auth tag when ciphertext is tampered with", async () => {
    const key = randomBytes(32);
    const env = await aesGcmEncrypt(key, utf8ToBytes("sensitive"));
    const i = env.length - 1;
    env[i] = (env[i] ?? 0) ^ 0xff; // flip a tag byte
    await expect(aesGcmDecrypt(key, env)).rejects.toThrow(/tampered|corrupt|wrong/i);
  });

  it("fails when the wrong key is used", async () => {
    const env = await aesGcmEncrypt(randomBytes(32), utf8ToBytes("x"));
    await expect(aesGcmDecrypt(randomBytes(32), env)).rejects.toThrow();
  });

  it("binds AAD: decrypting with different AAD fails", async () => {
    const key = randomBytes(32);
    const env = await aesGcmEncrypt(key, utf8ToBytes("x"), utf8ToBytes("file:1"));
    await expect(aesGcmDecrypt(key, env, utf8ToBytes("file:2"))).rejects.toThrow();
  });

  it("rejects non-256-bit keys", async () => {
    await expect(aesGcmEncrypt(randomBytes(16), utf8ToBytes("x"))).rejects.toThrow(/32 bytes/);
  });
});

describe("KDF", () => {
  it("is deterministic for same password+salt and differs across salts", () => {
    const salt = randomBytes(16);
    const a = deriveKey("hunter2", salt, FAST);
    const b = deriveKey("hunter2", salt, FAST);
    const c = deriveKey("hunter2", randomBytes(16), FAST);
    expect(a.length).toBe(32);
    expect(timingSafeEqual(a, b)).toBe(true);
    expect(timingSafeEqual(a, c)).toBe(false);
  });
});

describe("file encryption (per-file DEK wrapped by LMK)", () => {
  it("round-trips a file and supports crypto-shredding semantics", async () => {
    const lmk = generateLocalMasterKey();
    const bytes = randomBytes(5000);
    const enc = await encryptFile(lmk, bytes, "doc-123");
    const dec = await decryptFile(lmk, enc, "doc-123");
    expect(timingSafeEqual(dec, bytes)).toBe(true);

    // Crypto-shred: destroy the wrapped DEK -> ciphertext is unrecoverable.
    enc.wrappedDek = randomBytes(enc.wrappedDek.length);
    await expect(decryptFile(lmk, enc, "doc-123")).rejects.toThrow();
  });

  it("a file encrypted for one id cannot be decrypted under another id", async () => {
    const lmk = generateLocalMasterKey();
    const enc = await encryptFile(lmk, utf8ToBytes("x"), "doc-A");
    await expect(decryptFile(lmk, enc, "doc-B")).rejects.toThrow();
  });
});

describe("zero-knowledge backup keyset + recovery (DECISIONS #1/#2)", () => {
  it("password unlock yields the live BMK", async () => {
    const { keyset, bmk } = await createBackupKeyset("correct horse battery", FAST);
    const viaPwd = await unlockWithPassword(keyset, "correct horse battery");
    expect(timingSafeEqual(viaPwd, bmk)).toBe(true);
  });

  it("wrong password fails", async () => {
    const { keyset } = await createBackupKeyset("right-password", FAST);
    await expect(unlockWithPassword(keyset, "wrong-password")).rejects.toThrow();
  });

  it("recovery phrase unlocks the same BMK when the password is forgotten", async () => {
    const { keyset, recoveryPhrase, bmk } = await createBackupKeyset("forgotten-later", FAST);
    const viaRecovery = await unlockWithRecoveryPhrase(keyset, recoveryPhrase);
    expect(timingSafeEqual(viaRecovery, bmk)).toBe(true);
  });

  it("recovery phrase is a valid 24-word mnemonic", async () => {
    const { recoveryPhrase } = await createBackupKeyset("pw", FAST);
    expect(recoveryPhrase.split(" ")).toHaveLength(24);
    expect(() => recoveryKeyFromPhrase(recoveryPhrase)).not.toThrow();
  });

  it("rejects a tampered recovery phrase (checksum)", () => {
    expect(() => recoveryKeyFromPhrase("abandon abandon abandon")).toThrow(/invalid/i);
  });

  it("after recovery, a new password re-wraps and works; recovery still works", async () => {
    const { keyset, recoveryPhrase, bmk } = await createBackupKeyset("old-pw", FAST);
    const recovered = await unlockWithRecoveryPhrase(keyset, recoveryPhrase);
    const next = await rewrapPassword(keyset, recovered, "new-pw", FAST);

    expect(timingSafeEqual(await unlockWithPassword(next, "new-pw"), bmk)).toBe(true);
    await expect(unlockWithPassword(next, "old-pw")).rejects.toThrow();
    expect(timingSafeEqual(await unlockWithRecoveryPhrase(next, recoveryPhrase), bmk)).toBe(true);
  });
});

describe("recovery kit (encrypted-file fallback)", () => {
  it("round-trips the recovery key under a passphrase", async () => {
    const { keyset, recoveryPhrase } = await createBackupKeyset("pw", FAST);
    const recoveryKey = recoveryKeyFromPhrase(recoveryPhrase);
    const kit = await exportRecoveryKit(recoveryKey, "kit-pass", FAST);
    const imported = await importRecoveryKit(kit, "kit-pass");
    expect(timingSafeEqual(imported, recoveryKey)).toBe(true);
    // and it actually unlocks the backup
    const bmk = await unlockWithRecoveryPhrase(keyset, recoveryPhrase);
    expect(bmk.length).toBe(32);
  });

  it("wrong kit passphrase fails", async () => {
    const kit = await exportRecoveryKit(randomBytes(32), "right", FAST);
    await expect(importRecoveryKit(kit, "wrong")).rejects.toThrow();
  });
});
