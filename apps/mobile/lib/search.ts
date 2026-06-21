import { SearchIndex, type SearchDocument } from "@vaultmind/search";
import { expoSqliteSearchDriver } from "./db";
import type { VaultDocument } from "@vaultmind/vault-core";

/** Real FTS5 search on device via the shared SearchIndex + expo-sqlite driver. */
export function searchDocs(docs: VaultDocument[], query: string): VaultDocument[] {
  const idx = new SearchIndex(expoSqliteSearchDriver);
  for (const d of docs) {
    const docDate = d.metadata.documentDate ?? d.metadata.expiryDate;
    const row: SearchDocument = {
      docId: d.id,
      title: d.title,
      text: d.ocr.text ?? "",
      tags: d.tags,
      category: d.category,
      createdAt: d.createdAt,
      mime: d.mimeType,
      ...(d.notes ? { notes: d.notes } : {}),
      ...(docDate ? { docDate } : {}),
    };
    idx.upsert(row);
  }
  const hits = idx.search(query);
  idx.close();
  const byId = new Map(docs.map((d) => [d.id, d]));
  return hits.map((h) => byId.get(h.docId)).filter((d): d is VaultDocument => Boolean(d));
}
