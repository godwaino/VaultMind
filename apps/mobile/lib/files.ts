/**
 * Encrypted blob storage on device (expo-file-system). Implements vault-core's
 * BlobStore; the bytes written here are already AES-256-GCM ciphertext from
 * EncryptedFileStore. Stored base64 under the app's private document directory.
 */
import * as FileSystem from "expo-file-system";
import type { BlobStore } from "@vaultmind/vault-core";

const DIR = `${FileSystem.documentDirectory}vault/`;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}
const pathFor = (key: string) => `${DIR}${key}.enc`;

function toBase64(b: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]!);
  return globalThis.btoa(bin);
}
function fromBase64(s: string): Uint8Array {
  const bin = globalThis.atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export class FsBlobStore implements BlobStore {
  async put(key: string, bytes: Uint8Array) {
    await ensureDir();
    await FileSystem.writeAsStringAsync(pathFor(key), toBase64(bytes), { encoding: FileSystem.EncodingType.Base64 });
  }
  async get(key: string) {
    const b64 = await FileSystem.readAsStringAsync(pathFor(key), { encoding: FileSystem.EncodingType.Base64 });
    return fromBase64(b64);
  }
  async delete(key: string) {
    await FileSystem.deleteAsync(pathFor(key), { idempotent: true });
  }
  async has(key: string) {
    return (await FileSystem.getInfoAsync(pathFor(key))).exists;
  }
}
