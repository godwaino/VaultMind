/**
 * @vaultmind/crypto — all cryptographic primitives for the device key hierarchy,
 * zero-knowledge backup, and recovery (ARCHITECTURE §3.2, §5; DECISIONS.md #1/#2).
 *
 * Platform note: encrypt/decrypt use WebCrypto `subtle` + a CSPRNG. Both exist in
 * Node 22. In React Native, the app must import `react-native-get-random-values`
 * at entry and provide a `subtle` polyfill (e.g. react-native-quick-crypto) before
 * any function here is called. Argon2id and BIP39 are pure JS (no native dep).
 */

export { utf8ToBytes, bytesToUtf8, toBase64, fromBase64, timingSafeEqual } from "./encoding.js";
export { randomBytes } from "./random.js";
export { aesGcmEncrypt, aesGcmDecrypt } from "./aesgcm.js";
export { deriveKey, DEFAULT_ARGON2_PARAMS, type Argon2Params } from "./kdf.js";
export {
  generateKey,
  generateLocalMasterKey,
  generateDataEncryptionKey,
  wrapKey,
  unwrapKey,
  encryptFile,
  decryptFile,
  type EncryptedFile,
} from "./keys.js";
export {
  createBackupKeyset,
  unlockWithPassword,
  unlockWithRecoveryPhrase,
  rewrapPassword,
  recoveryKeyFromPhrase,
  type BackupKeyset,
  type NewBackupKeyset,
} from "./backup.js";
export { exportRecoveryKit, importRecoveryKit } from "./recoveryKit.js";
