import { describe, it, expect } from "vitest";
import { generateKey, utf8ToBytes, bytesToUtf8, randomBytes } from "@vaultmind/crypto";
import {
  buildBackup,
  runBackup,
  restoreBackup,
  fetchManifest,
  remoteWipe,
  BackupCapExceededError,
  FREE_TIER_BACKUP_BYTES,
  type BackupTransport,
  type BackupItem,
} from "./index.js";

class MemoryTransport implements BackupTransport {
  store = new Map<string, Uint8Array>();
  async upload(key: string, bytes: Uint8Array) { this.store.set(key, bytes); }
  async download(key: string) {
    const v = this.store.get(key);
    if (!v) throw new Error(`missing ${key}`);
    return v;
  }
  async list(prefix: string) { return [...this.store.keys()].filter((k) => k.startsWith(prefix)); }
  async remove(key: string) { this.store.delete(key); }
}

const items: BackupItem[] = [
  { docId: "d1", bytes: utf8ToBytes("passport blob bytes") },
  { docId: "d2", bytes: utf8ToBytes("tenancy blob bytes") },
];
const opts = { createdAt: "2026-06-15T00:00:00Z" };

describe("backup-core", () => {
  it("backs up and restores round-trip through the transport", async () => {
    const bmk = generateKey();
    const transport = new MemoryTransport();
    const manifest = await runBackup("u1", items, bmk, transport, opts);
    expect(manifest.entryCount).toBe(2);

    const fetched = await fetchManifest("u1", bmk, transport);
    expect(fetched.entries.map((e) => e.docId)).toEqual(["d1", "d2"]);

    const restored = await restoreBackup("u1", fetched, bmk, transport);
    expect(bytesToUtf8(restored[0]!.bytes)).toBe("passport blob bytes");
    expect(bytesToUtf8(restored[1]!.bytes)).toBe("tenancy blob bytes");
  });

  it("stores only ciphertext (server is zero-knowledge)", async () => {
    const bmk = generateKey();
    const transport = new MemoryTransport();
    await runBackup("u1", items, bmk, transport, opts);
    const blob = await transport.download("u1/d1.enc");
    expect(bytesToUtf8(blob).includes("passport")).toBe(false);
  });

  it("the wrong key cannot restore (tamper/zero-knowledge)", async () => {
    const transport = new MemoryTransport();
    const manifest = await runBackup("u1", items, generateKey(), transport, opts);
    await expect(restoreBackup("u1", manifest, generateKey(), transport)).rejects.toThrow();
  });

  it("enforces the free-tier 5 GB cap", async () => {
    const big: BackupItem[] = [{ docId: "huge", bytes: randomBytes(1024) }];
    await expect(buildBackup("u1", big, generateKey(), { ...opts, maxBytes: 100 })).rejects.toBeInstanceOf(
      BackupCapExceededError
    );
    // sanity: the real cap is 5 GiB
    expect(FREE_TIER_BACKUP_BYTES).toBe(5 * 1024 * 1024 * 1024);
  });

  it("remote-wipe deletes every object for the user (REQ-VAULT-027)", async () => {
    const bmk = generateKey();
    const transport = new MemoryTransport();
    await runBackup("u1", items, bmk, transport, opts);
    await runBackup("u2", items, bmk, transport, opts); // another user
    const removed = await remoteWipe("u1", transport);
    expect(removed).toBe(3); // d1, d2, manifest
    expect(await transport.list("u1/")).toHaveLength(0);
    expect((await transport.list("u2/")).length).toBeGreaterThan(0); // untouched
  });
});
