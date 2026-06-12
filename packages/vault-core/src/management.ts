/**
 * Document management (REQ-VAULT-012/013, 016, 018..021): rename, notes, category
 * override, tags, sorting, and delete with a 7-day undo grace followed by
 * crypto-shredding.
 */

import { isDocumentCategory, type DocumentCategory } from "./categories.js";
import type { SortDir, SortKey, VaultDocument } from "./model.js";
import type { Clock, DocRepo } from "./ports.js";
import type { EncryptedFileStore } from "./fileStore.js";

export const DELETE_GRACE_DAYS = 7;

async function mutate(
  repo: DocRepo,
  clock: Clock,
  id: string,
  fn: (doc: VaultDocument) => void
): Promise<VaultDocument> {
  const doc = await repo.get(id);
  if (!doc || doc.deletedAt) throw new Error(`Document ${id} not found`);
  fn(doc);
  doc.updatedAt = clock.now().toISOString();
  await repo.update(doc);
  return doc;
}

export function renameDocument(repo: DocRepo, clock: Clock, id: string, title: string) {
  const t = title.trim();
  if (!t) throw new Error("Title cannot be empty");
  return mutate(repo, clock, id, (d) => {
    d.title = t;
  });
}

export function setNotes(repo: DocRepo, clock: Clock, id: string, notes: string) {
  return mutate(repo, clock, id, (d) => {
    d.notes = notes;
  });
}

/** Manual category override (REQ-VAULT-012). */
export function setCategory(repo: DocRepo, clock: Clock, id: string, category: DocumentCategory) {
  if (!isDocumentCategory(category)) throw new Error(`Unknown category ${category}`);
  return mutate(repo, clock, id, (d) => {
    d.category = category;
  });
}

export function addTag(repo: DocRepo, clock: Clock, id: string, tag: string) {
  const t = tag.trim().toLowerCase();
  if (!t) throw new Error("Tag cannot be empty");
  return mutate(repo, clock, id, (d) => {
    if (!d.tags.includes(t)) d.tags.push(t);
  });
}

export function removeTag(repo: DocRepo, clock: Clock, id: string, tag: string) {
  const t = tag.trim().toLowerCase();
  return mutate(repo, clock, id, (d) => {
    d.tags = d.tags.filter((x) => x !== t);
  });
}

function sortValue(d: VaultDocument, key: SortKey): string {
  switch (key) {
    case "title":
      return d.title;
    case "createdAt":
      return d.createdAt;
    case "updatedAt":
      return d.updatedAt;
    case "expiryDate":
      return d.metadata.expiryDate ?? "";
  }
}

/** Pure sort over already-loaded documents (REQ-VAULT-016). */
export function sortDocuments(
  docs: VaultDocument[],
  key: SortKey,
  dir: SortDir = "desc"
): VaultDocument[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...docs].sort((a, b) => {
    const av = sortValue(a, key);
    const bv = sortValue(b, key);
    if (av < bv) return -1 * mul;
    if (av > bv) return 1 * mul;
    return 0;
  });
}

// --- deletion: soft-delete -> 7-day grace -> crypto-shred (REQ-VAULT-018..021) ---

export function softDeleteDocument(repo: DocRepo, clock: Clock, id: string) {
  return mutate(repo, clock, id, (d) => {
    d.deletedAt = clock.now().toISOString();
  });
}

/** Undo within the grace window (REQ-VAULT-019). */
export async function undoDelete(repo: DocRepo, clock: Clock, id: string): Promise<VaultDocument> {
  const doc = await repo.get(id);
  if (!doc) throw new Error(`Document ${id} not found`);
  if (!doc.deletedAt) return doc;
  doc.deletedAt = null;
  doc.updatedAt = clock.now().toISOString();
  await repo.update(doc);
  return doc;
}

/**
 * Purge documents whose grace window has elapsed: crypto-shred the file (destroy
 * its wrapped DEK by deleting the blob) then hard-delete the record (REQ-VAULT-021).
 * Returns the ids purged. Run on app start / periodically.
 */
export async function purgeExpiredDeletions(
  repo: DocRepo,
  files: EncryptedFileStore,
  clock: Clock,
  graceDays = DELETE_GRACE_DAYS
): Promise<string[]> {
  const cutoff = clock.now().getTime() - graceDays * 24 * 60 * 60 * 1000;
  const purged: string[] = [];
  for (const doc of await repo.list({ includeDeleted: true })) {
    if (doc.deletedAt && Date.parse(doc.deletedAt) <= cutoff) {
      await files.shred(doc.id);
      await repo.hardDelete(doc.id);
      purged.push(doc.id);
    }
  }
  return purged;
}
