/**
 * In-memory adapters — used by tests and as reference implementations of the
 * ports. On device these are replaced by expo-file-system, expo-sqlite, Tesseract,
 * and the SLM. The shapes here are the contract those native adapters must meet.
 */

import type { BlobStore, DocRepo, IdProvider, Clock, JobStore, PipelineJob } from "./ports.js";
import type { VaultDocument } from "./model.js";

export class InMemoryBlobStore implements BlobStore {
  private readonly map = new Map<string, Uint8Array>();
  async put(key: string, bytes: Uint8Array): Promise<void> {
    this.map.set(key, bytes);
  }
  async get(key: string): Promise<Uint8Array> {
    const v = this.map.get(key);
    if (!v) throw new Error(`No blob for key ${key}`);
    return v;
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
  async has(key: string): Promise<boolean> {
    return this.map.has(key);
  }
  get size(): number {
    return this.map.size;
  }
}

export class InMemoryDocRepo implements DocRepo {
  private readonly map = new Map<string, VaultDocument>();
  async insert(doc: VaultDocument): Promise<void> {
    if (this.map.has(doc.id)) throw new Error(`Doc ${doc.id} already exists`);
    this.map.set(doc.id, structuredClone(doc));
  }
  async update(doc: VaultDocument): Promise<void> {
    if (!this.map.has(doc.id)) throw new Error(`Doc ${doc.id} not found`);
    this.map.set(doc.id, structuredClone(doc));
  }
  async get(id: string): Promise<VaultDocument | null> {
    const v = this.map.get(id);
    return v ? structuredClone(v) : null;
  }
  async list(opts?: { includeDeleted?: boolean }): Promise<VaultDocument[]> {
    const all = [...this.map.values()].map((d) => structuredClone(d));
    return opts?.includeDeleted ? all : all.filter((d) => !d.deletedAt);
  }
  async liveContentHashes(): Promise<Set<string>> {
    const s = new Set<string>();
    for (const d of this.map.values()) if (!d.deletedAt) s.add(d.contentHash);
    return s;
  }
  async liveCount(): Promise<number> {
    let n = 0;
    for (const d of this.map.values()) if (!d.deletedAt) n++;
    return n;
  }
  async hardDelete(id: string): Promise<void> {
    this.map.delete(id);
  }
}

export class InMemoryJobStore implements JobStore {
  private readonly map = new Map<string, PipelineJob>();
  async save(job: PipelineJob): Promise<void> {
    this.map.set(job.id, { ...job });
  }
  async get(id: string): Promise<PipelineJob | null> {
    const v = this.map.get(id);
    return v ? { ...v } : null;
  }
  async pending(): Promise<PipelineJob[]> {
    return [...this.map.values()]
      .filter((j) => j.stage !== "done" && !j.awaitingUser)
      .map((j) => ({ ...j }));
  }
  async delete(id: string): Promise<void> {
    this.map.delete(id);
  }
}

let counter = 0;
export const sequentialIdProvider: IdProvider = {
  newId: () => `doc_${(++counter).toString(36).padStart(6, "0")}`,
};

export function fixedClock(startIso = "2026-06-01T00:00:00.000Z"): Clock {
  let t = Date.parse(startIso);
  return { now: () => new Date((t += 1000)) };
}
