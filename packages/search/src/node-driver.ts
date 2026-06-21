/**
 * Node SQLite driver for @vaultmind/search — used by tests, dev, and any Node
 * runtime. Loaded via createRequire so bundlers don't try to transform the newer
 * `node:sqlite` builtin. Requires Node run with --experimental-sqlite.
 *
 * This file is a SEPARATE entry point so browser/React Native builds never import
 * node:sqlite — they pass their own driver (wa-sqlite / expo-sqlite) to SearchIndex.
 */

import { createRequire } from "node:module";
import type { SqliteDb, SqliteDbFactory } from "./index.js";

const nodeRequire = createRequire(import.meta.url);

export const nodeSqliteDriver: SqliteDbFactory = () => {
  const { DatabaseSync } = nodeRequire("node:sqlite") as {
    DatabaseSync: new (path: string) => SqliteDb;
  };
  return new DatabaseSync(":memory:");
};
