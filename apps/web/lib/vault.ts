"use client";

import {
  validateUpload,
  sha256Hex,
  EncryptedFileStore,
  type VaultDocument,
  type DocumentCategory,
} from "@vaultmind/vault-core";
import { IdbBlobStore, IdbDocRepo, getOrCreateLmk } from "./idb";

export async function getStores() {
  const lmk = await getOrCreateLmk();
  return { files: new EncryptedFileStore(new IdbBlobStore(), lmk), repo: new IdbDocRepo() };
}

export interface NewDocInput {
  file: File;
  title?: string;
  category: DocumentCategory;
  expiryDate?: string;
  notes?: string;
}

export type IngestResult =
  | { ok: true; doc: VaultDocument }
  | { ok: false; errors: string[] }
  | { ok: false; duplicateId: string };

export async function ingest(input: NewDocInput): Promise<IngestResult> {
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  // Page count isn't readily available in-browser without a PDF lib; treat as 1.
  // (On web, metadata is entered manually — there is no on-device OCR/SLM.)
  const v = validateUpload({ mimeType: input.file.type, sizeBytes: bytes.length, pageCount: 1 });
  if (!v.ok) return { ok: false, errors: v.errors };

  const { files, repo } = await getStores();
  const hash = sha256Hex(bytes);
  if ((await repo.liveContentHashes()).has(hash)) {
    const dup = (await repo.list()).find((d) => d.contentHash === hash);
    return { ok: false, duplicateId: dup ? dup.id : "" };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await files.put(id, bytes);

  const doc: VaultDocument = {
    id,
    title: input.title?.trim() || input.file.name,
    category: input.category,
    tags: [],
    mimeType: input.file.type,
    sizeBytes: bytes.length,
    pageCount: 1,
    contentHash: hash,
    ...(input.notes ? { notes: input.notes } : {}),
    metadata: input.expiryDate ? { expiryDate: input.expiryDate } : {},
    ocr: { status: "done", confidence: 1, engine: "cloud", text: "" },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await repo.insert(doc);
  return { ok: true, doc };
}

export async function listDocs(): Promise<VaultDocument[]> {
  return (await getStores()).repo.list();
}
export async function getDoc(id: string): Promise<VaultDocument | null> {
  return (await getStores()).repo.get(id);
}
export async function getDocBlobUrl(id: string): Promise<string> {
  const { files, repo } = await getStores();
  const doc = await repo.get(id);
  const bytes = await files.get(id);
  const blob = new Blob([bytes as BlobPart], { type: doc?.mimeType ?? "application/octet-stream" });
  return URL.createObjectURL(blob);
}
export async function deleteDoc(id: string): Promise<void> {
  const { files, repo } = await getStores();
  await files.shred(id); // crypto-shred: drop the only copy of the wrapped DEK
  await repo.hardDelete(id);
}
