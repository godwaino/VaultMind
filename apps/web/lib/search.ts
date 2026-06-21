"use client";

import { rewriteQuery } from "@vaultmind/search";
import type { VaultDocument } from "@vaultmind/vault-core";

/**
 * Browser search. We reuse the shared query rewriter (year/category/stopwords) but
 * rank with a lightweight in-memory scan instead of SQLite FTS5 — the companion
 * holds the user's decrypted metadata in memory, and this avoids shipping a WASM
 * SQLite build. A wa-sqlite driver for the shared SearchIndex is the upgrade path
 * for very large libraries.
 */
export function searchDocs(docs: VaultDocument[], query: string): VaultDocument[] {
  const q = rewriteQuery(query);
  if (!q.match) return docs;
  return docs
    .map((d) => {
      const title = d.title.toLowerCase();
      const hay = [d.title, d.category, d.tags.join(" "), d.notes ?? "", d.ocr.text ?? "", d.metadata.issuer ?? ""]
        .join(" ")
        .toLowerCase();
      let score = 0;
      for (const t of q.terms) if (hay.includes(t)) score += title.includes(t) ? 3 : 1;
      if (q.categoryHint && d.category === q.categoryHint) score += 1.5;
      const date = d.metadata.documentDate ?? d.metadata.expiryDate ?? "";
      if (q.year && date.startsWith(String(q.year))) score += 1;
      return { d, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.d);
}
