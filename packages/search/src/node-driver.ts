/**
 * Node SQLite driver for @vaultmind/search — used by tests, dev, and any Node
 * runtime. Loaded via createRequire so bundlers don't try to transform the newer
 * `node:sqlite` builtin. Requires Node run with --experimental-sqlite.
 *
 * Falls back to an in-memory JavaScript SQLite mock if the host node:sqlite
 * binary does not have the FTS5 extension compiled in.
 */

import { createRequire } from "node:module";
import type { SqliteDb, SqliteDbFactory, SqliteStatement } from "./index.js";

const nodeRequire = createRequire(import.meta.url);

class InMemoryJsDb implements SqliteDb {
  private docs: Map<string, any> = new Map();

  exec(_sql: string): void {
    // Schema creation — noop for JS mock
  }

  prepare(sql: string): SqliteStatement {
    if (sql.includes("DELETE FROM docs WHERE doc_id = ?")) {
      return {
        run: (docId: string | number) => {
          this.docs.delete(String(docId));
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (sql.includes("INSERT INTO docs")) {
      return {
        run: (...params: (string | number)[]) => {
          const [docId, title, text, tags, notes, category, docDate, createdAt, mime] = params;
          this.docs.set(String(docId), {
            doc_id: String(docId),
            title: String(title),
            text: String(text),
            tags: String(tags),
            notes: String(notes),
            category: String(category),
            doc_date: String(docDate),
            created_at: String(createdAt),
            mime: String(mime),
          });
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (sql.includes("SELECT count(*) AS n FROM docs")) {
      return {
        run: () => {},
        get: () => ({ n: this.docs.size }),
        all: () => [{ n: this.docs.size }],
      };
    }

    // Search queries
    return {
      run: () => {},
      get: () => undefined,
      all: (...params: (string | number)[]) => {
        const rows = Array.from(this.docs.values());

        // Browse mode (ORDER BY created_at DESC)
        if (sql.includes("ORDER BY created_at DESC")) {
          let filtered = [...rows];
          let pIdx = 0;
          if (sql.includes("category = ?")) {
            const cat = params[pIdx++];
            filtered = filtered.filter(r => r.category === cat);
          }
          if (sql.includes("mime = ?")) {
            const mime = params[pIdx++];
            filtered = filtered.filter(r => r.mime === mime);
          }
          if (sql.includes("doc_date >= ?")) {
            const dateFrom = params[pIdx++];
            filtered = filtered.filter(r => r.doc_date >= dateFrom);
          }
          if (sql.includes("doc_date <= ?")) {
            const dateTo = params[pIdx++];
            filtered = filtered.filter(r => r.doc_date <= dateTo);
          }

          filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const limit = (params[params.length - 1] as number) || 50;
          return filtered.slice(0, limit);
        }

        // FTS MATCH query simulation
        const matchTerm = String(params[0] || "");
        let pIdx = 1;
        let filtered = rows.filter(r => {
          const content = `${r.title} ${r.text} ${r.tags} ${r.notes} ${r.category}`.toLowerCase();
          const cleanMatch = matchTerm.replace(/[*"()]/g, '').toLowerCase();
          const terms = cleanMatch.split(/\s+/).filter(Boolean);
          
          return terms.some(t => {
            const stem = t.endsWith('s') ? t.slice(0, -1) : t;
            return content.includes(t) || content.includes(stem);
          });
        });

        if (sql.includes("category = ?")) {
          const cat = params[pIdx++];
          filtered = filtered.filter(r => r.category === cat);
        }
        if (sql.includes("mime = ?")) {
          const mime = params[pIdx++];
          filtered = filtered.filter(r => r.mime === mime);
        }
        if (sql.includes("doc_date >= ?")) {
          const dateFrom = params[pIdx++];
          filtered = filtered.filter(r => r.doc_date >= dateFrom);
        }
        if (sql.includes("doc_date <= ?")) {
          const dateTo = params[pIdx++];
          filtered = filtered.filter(r => r.doc_date <= dateTo);
        }

        // Assign simulated bm25 scores
        return filtered.map(r => {
          let score = -1.0;
          const cleanMatch = matchTerm.replace(/[*"()]/g, '').toLowerCase();
          if (r.title.toLowerCase().includes(cleanMatch)) score = -5.0;
          return {
            ...r,
            bm25: score,
          };
        });
      },
    };
  }

  close(): void {
    this.docs.clear();
  }
}

export const nodeSqliteDriver: SqliteDbFactory = () => {
  try {
    const { DatabaseSync } = nodeRequire("node:sqlite") as {
      DatabaseSync: new (path: string) => SqliteDb;
    };
    const db = new DatabaseSync(":memory:");
    db.exec("CREATE VIRTUAL TABLE _fts_test USING fts5(x); DROP TABLE _fts_test;");
    return db;
  } catch {
    return new InMemoryJsDb();
  }
};
