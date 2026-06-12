/**
 * @vaultmind/search — offline full-text search over the vault (REQ-VAULT-014..017,
 * NFR-PERF-003 <2s @ 200 docs). SQLite FTS5 with the porter stemmer; BM25 ranking
 * boosted by category match, recency, and year hits. No embeddings in MVP (ADR-001).
 *
 * Storage: this implementation uses Node's built-in `node:sqlite` (run Node with
 * --experimental-sqlite / NODE_OPTIONS=--experimental-sqlite). On device the exact
 * same SQL runs on expo-sqlite, which also bundles FTS5. The index holds only data
 * already on the device; nothing here is networked.
 */

import { createRequire } from "node:module";
import { rewriteQuery } from "./query.js";

/**
 * Minimal handle interface — the subset of node:sqlite / expo-sqlite we use. The
 * same SQL runs against expo-sqlite on device behind an adapter of this shape.
 */
interface SqliteStatement {
  run(...params: (string | number)[]): unknown;
  get(...params: (string | number)[]): unknown;
  all(...params: (string | number)[]): unknown[];
}
interface SqliteDb {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

// Loaded via createRequire so the bundler/test runner doesn't try to transform the
// newer `node:sqlite` builtin. Requires Node run with --experimental-sqlite.
const nodeRequire = createRequire(import.meta.url);
function openInMemoryDb(): SqliteDb {
  const { DatabaseSync } = nodeRequire("node:sqlite") as {
    DatabaseSync: new (path: string) => SqliteDb;
  };
  return new DatabaseSync(":memory:");
}

export { rewriteQuery, type RewrittenQuery } from "./query.js";

export interface SearchDocument {
  docId: string;
  title: string;
  /** OCR text + any extracted body */
  text: string;
  tags: string[];
  notes?: string;
  category: string;
  /** ISO yyyy-mm-dd of the document's own date, if known */
  docDate?: string;
  /** ISO timestamp the doc was added — drives the recency boost */
  createdAt: string;
  mime: string;
}

export interface SearchFilters {
  category?: string;
  /** inclusive ISO date range on docDate */
  dateFrom?: string;
  dateTo?: string;
  mime?: string;
}

export interface SearchHit {
  docId: string;
  title: string;
  category: string;
  score: number;
  bm25: number;
}

// bm25 weights, one per FTS5 column in declaration order.
const BM25_WEIGHTS = [
  0, // doc_id (unindexed)
  10, // title
  4, // text
  6, // tags
  3, // notes
  5, // category
];

export class SearchIndex {
  private readonly db: SqliteDb;

  constructor() {
    this.db = openInMemoryDb();
    this.db.exec(`
      CREATE VIRTUAL TABLE docs USING fts5(
        doc_id UNINDEXED,
        title, text, tags, notes, category,
        doc_date UNINDEXED,
        created_at UNINDEXED,
        mime UNINDEXED,
        tokenize = 'porter unicode61'
      );
    `);
  }

  /** Insert or replace a document in the index (REQ-VAULT-015: index on save). */
  upsert(doc: SearchDocument): void {
    this.db.prepare("DELETE FROM docs WHERE doc_id = ?").run(doc.docId);
    this.db
      .prepare(
        `INSERT INTO docs (doc_id, title, text, tags, notes, category, doc_date, created_at, mime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        doc.docId,
        doc.title,
        doc.text,
        doc.tags.join(" "),
        doc.notes ?? "",
        doc.category,
        doc.docDate ?? "",
        doc.createdAt,
        doc.mime
      );
  }

  remove(docId: string): void {
    this.db.prepare("DELETE FROM docs WHERE doc_id = ?").run(docId);
  }

  size(): number {
    const row = this.db.prepare("SELECT count(*) AS n FROM docs").get() as { n: number };
    return row.n;
  }

  search(query: string, filters: SearchFilters = {}, limit = 50): SearchHit[] {
    const q = rewriteQuery(query);
    const where: string[] = [];
    const params: (string | number)[] = [];

    if (q.match) {
      where.push("docs MATCH ?");
      params.push(q.match);
    }
    if (filters.category) {
      where.push("category = ?");
      params.push(filters.category);
    }
    if (filters.mime) {
      where.push("mime = ?");
      params.push(filters.mime);
    }
    if (filters.dateFrom) {
      where.push("doc_date >= ?");
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      where.push("doc_date <= ?");
      params.push(filters.dateTo);
    }

    // Browse mode (no text terms): newest first, filters only.
    if (!q.match) {
      const sql = `SELECT doc_id, title, category, created_at, doc_date FROM docs
                   ${where.length ? "WHERE " + where.join(" AND ") : ""}
                   ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);
      const rows = this.db.prepare(sql).all(...params) as RawRow[];
      return rows.map((r) => ({
        docId: r.doc_id,
        title: r.title,
        category: r.category,
        score: 0,
        bm25: 0,
      }));
    }

    const weights = BM25_WEIGHTS.join(", ");
    const sql = `SELECT doc_id, title, category, created_at, doc_date,
                        bm25(docs, ${weights}) AS bm25
                 FROM docs
                 WHERE ${where.join(" AND ")}
                 ORDER BY bm25
                 LIMIT 200`;
    const rows = this.db.prepare(sql).all(...params) as RawRow[];

    const now = Date.now();
    const hits = rows.map((r): SearchHit => {
      // bm25() is negative; more negative = better. Flip to a positive relevance.
      let score = -(r.bm25 ?? 0);

      // category boost
      if (q.categoryHint && r.category === q.categoryHint) score += 1.5;

      // year boost (document dated in the queried year)
      if (q.year && r.doc_date && r.doc_date.startsWith(String(q.year))) score += 1.0;

      // recency boost: up to +0.5, decaying over ~1 year
      const ageDays = (now - Date.parse(r.created_at)) / (1000 * 60 * 60 * 24);
      if (Number.isFinite(ageDays)) score += 0.5 * Math.max(0, 1 - ageDays / 365);

      return { docId: r.doc_id, title: r.title, category: r.category, score, bm25: r.bm25 ?? 0 };
    });

    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
  }

  close(): void {
    this.db.close();
  }
}

interface RawRow {
  doc_id: string;
  title: string;
  category: string;
  created_at: string;
  doc_date: string;
  bm25?: number;
}
