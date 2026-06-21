import * as FileSystem from "expo-file-system";
import * as Crypto from "expo-crypto";
import {
  validateUpload, sha256Hex, EncryptedFileStore,
  type VaultDocument, type DocumentCategory,
} from "@vaultmind/vault-core";
import { FsBlobStore } from "./files";
import { SqliteDocRepo } from "./db";
import { getOrCreateLmk } from "./keys";

function fromBase64(s: string): Uint8Array {
  const bin = globalThis.atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function toBase64(b: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]!);
  return globalThis.btoa(bin);
}

export async function getStores() {
  const lmk = await getOrCreateLmk();
  return { files: new EncryptedFileStore(new FsBlobStore(), lmk), repo: new SqliteDocRepo() };
}

export interface PickedFile { uri: string; name: string; mimeType: string; }
export interface NewDocInput { file: PickedFile; title?: string; category: DocumentCategory; expiryDate?: string; }
export type IngestResult =
  | { ok: true; doc: VaultDocument }
  | { ok: false; errors: string[] }
  | { ok: false; duplicateId: string };

export async function ingest(input: NewDocInput): Promise<IngestResult> {
  const b64 = await FileSystem.readAsStringAsync(input.file.uri, { encoding: FileSystem.EncodingType.Base64 });
  const bytes = fromBase64(b64);
  const v = validateUpload({ mimeType: input.file.mimeType, sizeBytes: bytes.length, pageCount: 1 });
  if (!v.ok) return { ok: false, errors: v.errors };

  const { files, repo } = await getStores();
  const hash = sha256Hex(bytes);
  if ((await repo.liveContentHashes()).has(hash)) {
    const dup = (await repo.list()).find((d) => d.contentHash === hash);
    return { ok: false, duplicateId: dup ? dup.id : "" };
  }
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await files.put(id, bytes);

  const doc: VaultDocument = {
    id,
    title: input.title?.trim() || input.file.name,
    category: input.category,
    tags: [],
    mimeType: input.file.mimeType,
    sizeBytes: bytes.length,
    pageCount: 1,
    contentHash: hash,
    metadata: input.expiryDate ? { expiryDate: input.expiryDate } : {},
    // On-device OCR (Tesseract) + SLM categorisation are the native TODO — see
    // docs/MOBILE_APP.md. Until wired, metadata is user-entered and text is empty.
    ocr: { status: "done", confidence: 1, engine: "tesseract", text: "" },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await repo.insert(doc);
  return { ok: true, doc };
}

export async function listDocs() { return (await getStores()).repo.list(); }
export async function getDoc(id: string) { return (await getStores()).repo.get(id); }
export async function deleteDoc(id: string) {
  const { files, repo } = await getStores();
  await files.shred(id);
  await repo.hardDelete(id);
}

/** Decrypt to a temp cache file for viewing; returns a file:// uri. */
export async function decryptToTemp(id: string): Promise<string> {
  const { files, repo } = await getStores();
  const doc = await repo.get(id);
  const bytes = await files.get(id);
  const ext = doc?.mimeType === "application/pdf" ? "pdf" : doc?.mimeType?.includes("png") ? "png" : "jpg";
  const uri = `${FileSystem.cacheDirectory}view-${id}.${ext}`;
  await FileSystem.writeAsStringAsync(uri, toBase64(bytes), { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}
