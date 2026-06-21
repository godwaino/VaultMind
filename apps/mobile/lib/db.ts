/**
 * On-device storage (expo-sqlite). Persistent metadata + the FTS5 search index.
 * Encrypted document blobs live in the filesystem (see files.ts); keys in the
 * Keychain/Keystore (see keys.ts). Nothing here leaves the device (NFR-SEC-006).
 */
import * as SQLite from "expo-sqlite";
import type { DocRepo, VaultDocument } from "@vaultmind/vault-core";
import type { TrackingRepo, TrackedDocument } from "@vaultmind/expiry-core";
import type { SqliteDb, SqliteDbFactory } from "@vaultmind/search";

let _db: SQLite.SQLiteDatabase | null = null;
function dbase(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync("vaultmind.db");
    _db.execSync(`
      CREATE TABLE IF NOT EXISTS docs (id TEXT PRIMARY KEY, json TEXT NOT NULL, content_hash TEXT, deleted_at TEXT);
      CREATE TABLE IF NOT EXISTS tracking (doc_id TEXT PRIMARY KEY, json TEXT NOT NULL);
    `);
  }
  return _db;
}

export class SqliteDocRepo implements DocRepo {
  async insert(doc: VaultDocument) {
    dbase().runSync("INSERT INTO docs (id, json, content_hash, deleted_at) VALUES (?, ?, ?, ?)",
      doc.id, JSON.stringify(doc), doc.contentHash, doc.deletedAt ?? null);
  }
  async update(doc: VaultDocument) {
    dbase().runSync("UPDATE docs SET json = ?, content_hash = ?, deleted_at = ? WHERE id = ?",
      JSON.stringify(doc), doc.contentHash, doc.deletedAt ?? null, doc.id);
  }
  async get(id: string) {
    const r = dbase().getFirstSync<{ json: string }>("SELECT json FROM docs WHERE id = ?", id);
    return r ? (JSON.parse(r.json) as VaultDocument) : null;
  }
  async list(opts?: { includeDeleted?: boolean }) {
    const rows = dbase().getAllSync<{ json: string }>("SELECT json FROM docs");
    const all = rows.map((r) => JSON.parse(r.json) as VaultDocument);
    return opts?.includeDeleted ? all : all.filter((d) => !d.deletedAt);
  }
  async liveContentHashes() {
    const rows = dbase().getAllSync<{ content_hash: string }>("SELECT content_hash FROM docs WHERE deleted_at IS NULL");
    return new Set(rows.map((r) => r.content_hash));
  }
  async liveCount() {
    const r = dbase().getFirstSync<{ n: number }>("SELECT count(*) AS n FROM docs WHERE deleted_at IS NULL");
    return r?.n ?? 0;
  }
  async hardDelete(id: string) { dbase().runSync("DELETE FROM docs WHERE id = ?", id); }
}

export class SqliteTrackingRepo implements TrackingRepo {
  async insert(t: TrackedDocument) { dbase().runSync("INSERT INTO tracking (doc_id, json) VALUES (?, ?)", t.docId, JSON.stringify(t)); }
  async update(t: TrackedDocument) { dbase().runSync("UPDATE tracking SET json = ? WHERE doc_id = ?", JSON.stringify(t), t.docId); }
  async get(docId: string) {
    const r = dbase().getFirstSync<{ json: string }>("SELECT json FROM tracking WHERE doc_id = ?", docId);
    return r ? (JSON.parse(r.json) as TrackedDocument) : null;
  }
  async list() {
    return dbase().getAllSync<{ json: string }>("SELECT json FROM tracking").map((r) => JSON.parse(r.json) as TrackedDocument);
  }
  async liveCount() { return (await this.list()).length; }
  async remove(docId: string) { dbase().runSync("DELETE FROM tracking WHERE doc_id = ?", docId); }
}

/**
 * Sync SQLite driver for the shared @vaultmind/search SearchIndex — real FTS5 on
 * device. We use an in-memory DB rebuilt from DocRepo on launch (the index is
 * derived data; the source of truth is the `docs` table + encrypted files).
 */
export const expoSqliteSearchDriver: SqliteDbFactory = () => {
  const mem = SQLite.openDatabaseSync(":memory:");
  const db: SqliteDb = {
    exec: (sql) => mem.execSync(sql),
    prepare: (sql) => ({
      run: (...p) => mem.runSync(sql, ...(p as SQLite.SQLiteBindValue[])),
      get: (...p) => mem.getFirstSync(sql, ...(p as SQLite.SQLiteBindValue[])),
      all: (...p) => mem.getAllSync(sql, ...(p as SQLite.SQLiteBindValue[])),
    }),
    close: () => mem.closeSync(),
  };
  return db;
};
