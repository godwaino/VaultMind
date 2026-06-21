/**
 * Browser storage for the companion app (zero-knowledge on web, DECISIONS / ADR-012).
 * Implements the vault-core + expiry-core ports over IndexedDB. Encrypted document
 * blobs and the Local Master Key live here; the server never sees them.
 *
 * Honest caveat: the LMK is stored as raw key bytes in IndexedDB. A hardened build
 * should wrap it as a non-extractable WebCrypto CryptoKey (or unlock via WebAuthn).
 * The most sensitive documents are best kept on the mobile app (hardware-backed).
 */
"use client";

import { openDB, type IDBPDatabase } from "idb";
import { generateLocalMasterKey } from "@vaultmind/crypto";
import type { BlobStore, DocRepo } from "@vaultmind/vault-core";
import type { VaultDocument } from "@vaultmind/vault-core";
import type { TrackingRepo } from "@vaultmind/expiry-core";
import type { TrackedDocument } from "@vaultmind/expiry-core";

const DB_NAME = "vaultmind";
let _db: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!_db) {
    _db = openDB(DB_NAME, 1, {
      upgrade(d) {
        d.createObjectStore("blobs");
        d.createObjectStore("docs");
        d.createObjectStore("tracking");
        d.createObjectStore("keys");
      },
    });
  }
  return _db;
}

export class IdbBlobStore implements BlobStore {
  async put(key: string, bytes: Uint8Array) { await (await db()).put("blobs", bytes, key); }
  async get(key: string) {
    const v = (await (await db()).get("blobs", key)) as Uint8Array | undefined;
    if (!v) throw new Error(`No blob for ${key}`);
    return v;
  }
  async delete(key: string) { await (await db()).delete("blobs", key); }
  async has(key: string) { return (await (await db()).getKey("blobs", key)) !== undefined; }
}

export class IdbDocRepo implements DocRepo {
  async insert(doc: VaultDocument) {
    const d = await db();
    if (await d.get("docs", doc.id)) throw new Error(`Doc ${doc.id} exists`);
    await d.put("docs", doc, doc.id);
  }
  async update(doc: VaultDocument) { await (await db()).put("docs", doc, doc.id); }
  async get(id: string) { return ((await (await db()).get("docs", id)) as VaultDocument) ?? null; }
  async list(opts?: { includeDeleted?: boolean }) {
    const all = ((await (await db()).getAll("docs")) as VaultDocument[]) ?? [];
    return opts?.includeDeleted ? all : all.filter((d) => !d.deletedAt);
  }
  async liveContentHashes() {
    const s = new Set<string>();
    for (const d of await this.list()) s.add(d.contentHash);
    return s;
  }
  async liveCount() { return (await this.list()).length; }
  async hardDelete(id: string) { await (await db()).delete("docs", id); }
}

export class IdbTrackingRepo implements TrackingRepo {
  async insert(t: TrackedDocument) {
    const d = await db();
    if (await d.get("tracking", t.docId)) throw new Error(`Already tracking ${t.docId}`);
    await d.put("tracking", t, t.docId);
  }
  async update(t: TrackedDocument) { await (await db()).put("tracking", t, t.docId); }
  async get(docId: string) { return ((await (await db()).get("tracking", docId)) as TrackedDocument) ?? null; }
  async list() { return ((await (await db()).getAll("tracking")) as TrackedDocument[]) ?? []; }
  async liveCount() { return (await this.list()).length; }
  async remove(docId: string) { await (await db()).delete("tracking", docId); }
}

/** Get or create the Local Master Key (32 bytes) for this browser profile. */
export async function getOrCreateLmk(): Promise<Uint8Array> {
  const d = await db();
  let lmk = (await d.get("keys", "lmk")) as Uint8Array | undefined;
  if (!lmk) {
    lmk = generateLocalMasterKey();
    await d.put("keys", lmk, "lmk");
  }
  return lmk;
}

/** Wipe all local data (used on sign-out-and-forget or local reset). */
export async function wipeLocal(): Promise<void> {
  const d = await db();
  await Promise.all(["blobs", "docs", "tracking", "keys"].map((s) => d.clear(s)));
}
