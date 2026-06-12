/**
 * EncryptedFileStore — encrypts document bytes with a per-file DEK (wrapped by the
 * LMK) before they touch the BlobStore (ARCHITECTURE §3.2). Deleting a document
 * destroys the stored blob, and because each file has its own DEK, dropping the
 * blob is effective crypto-shredding (REQ-VAULT-020 / NFR-SEC-007).
 *
 * Wire format of the stored blob:  [4-byte BE len(wrappedDek)] [wrappedDek] [ciphertext]
 */

import { encryptFile, decryptFile, type EncryptedFile } from "@vaultmind/crypto";
import type { BlobStore } from "./ports.js";

function pack(file: EncryptedFile): Uint8Array {
  const len = file.wrappedDek.length;
  const out = new Uint8Array(4 + len + file.ciphertext.length);
  new DataView(out.buffer).setUint32(0, len, false);
  out.set(file.wrappedDek, 4);
  out.set(file.ciphertext, 4 + len);
  return out;
}

function unpack(blob: Uint8Array): EncryptedFile {
  if (blob.length < 4) throw new Error("Corrupt encrypted blob");
  const len = new DataView(blob.buffer, blob.byteOffset, 4).getUint32(0, false);
  if (blob.length < 4 + len) throw new Error("Corrupt encrypted blob");
  return {
    wrappedDek: blob.subarray(4, 4 + len),
    ciphertext: blob.subarray(4 + len),
  };
}

export class EncryptedFileStore {
  constructor(
    private readonly blobs: BlobStore,
    /** Local Master Key from Keychain/Keystore (32 bytes). */
    private readonly lmk: Uint8Array
  ) {}

  async put(docId: string, plaintext: Uint8Array): Promise<void> {
    const enc = await encryptFile(this.lmk, plaintext, docId);
    await this.blobs.put(docId, pack(enc));
  }

  async get(docId: string): Promise<Uint8Array> {
    const blob = await this.blobs.get(docId);
    return decryptFile(this.lmk, unpack(blob), docId);
  }

  /** Crypto-shred: removing the blob removes the only copy of the wrapped DEK. */
  async shred(docId: string): Promise<void> {
    if (await this.blobs.has(docId)) await this.blobs.delete(docId);
  }
}
