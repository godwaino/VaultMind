/**
 * Web crypto bootstrap. The @vaultmind/crypto package already runs in the browser
 * unchanged — it uses the WebCrypto `subtle` API and `crypto.getRandomValues`,
 * which are native in browsers (no polyfill needed, unlike React Native). Argon2id
 * (@noble/hashes) and BIP39 are pure JS.
 *
 * So the SAME zero-knowledge model holds on web: the backup keyset, recovery
 * phrase, and per-file encryption all work here. The honest difference vs mobile
 * (documented in docs/WEB_COMPANION.md): the browser has no hardware-backed
 * Keychain/Keystore, so the Local Master Key is held as a non-extractable WebCrypto
 * CryptoKey in IndexedDB — strong, but not secure-enclave equivalent. Encrypted
 * document blobs live in IndexedDB/OPFS.
 */

import { createBackupKeyset, unlockWithRecoveryPhrase } from "@vaultmind/crypto";

// Re-exported so the web UI imports its crypto from one place. Storage of the LMK
// (IndexedDB, non-extractable key) is wired on a dev machine.
export { createBackupKeyset, unlockWithRecoveryPhrase };

export const WEB_KEY_STORAGE_NOTE =
  "On web, keys are held as non-extractable WebCrypto keys in IndexedDB. This is " +
  "weaker than mobile's hardware-backed Keychain/Keystore — surface this honestly " +
  "to the user; the most sensitive documents are best kept on the mobile app.";
