/**
 * Local Master Key storage in the hardware-backed Keychain (iOS) / Keystore
 * (Android) via expo-secure-store — the mobile privacy advantage over the web
 * companion (ARCHITECTURE §3.2). The LMK never leaves the secure enclave-backed
 * store; per-file DEKs are wrapped by it.
 */
import * as SecureStore from "expo-secure-store";
import { generateLocalMasterKey, toBase64, fromBase64 } from "@vaultmind/crypto";

const LMK_KEY = "vaultmind.lmk";

export async function getOrCreateLmk(): Promise<Uint8Array> {
  const existing = await SecureStore.getItemAsync(LMK_KEY, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  if (existing) return fromBase64(existing);
  const lmk = generateLocalMasterKey();
  await SecureStore.setItemAsync(LMK_KEY, toBase64(lmk), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return lmk;
}
