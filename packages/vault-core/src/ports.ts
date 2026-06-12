/**
 * Ports for the vault pipeline. Native/AI/storage concerns sit behind these
 * interfaces so the orchestration logic is fully unit-testable; on-device the
 * adapters are Tesseract, the SLM (llama.rn), expo-sqlite, and the encrypted file
 * store. In-memory adapters for tests/dev live in ./adapters.ts.
 */

import type { DocumentCategory } from "./categories.js";
import type { ExtractedMetadata, OcrEngine, VaultDocument } from "./model.js";

export interface IdProvider {
  newId(): string;
}
export interface Clock {
  now(): Date;
}

/** Opaque, already-encrypted blob persistence (filesystem on device). */
export interface BlobStore {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
}

/** OCR engine (REQ-VAULT-006). Device = Tesseract; cloud = Google Vision proxy. */
export interface OcrResult {
  text: string;
  /** mean confidence 0..1 */
  confidence: number;
  engine: OcrEngine;
}
export interface OcrProvider {
  recognize(bytes: Uint8Array, mimeType: string): Promise<OcrResult>;
}

/** SLM metadata extraction (REQ-VAULT-007) — GBNF-constrained JSON on device. */
export interface MetadataExtractor {
  extract(text: string): Promise<ExtractedMetadata>;
}

/** SLM categorisation (REQ-VAULT-010/011). */
export interface CategoriserResult {
  category: DocumentCategory;
  confidence: number;
}
export interface Categoriser {
  classify(text: string, metadata: ExtractedMetadata): Promise<CategoriserResult>;
}

/**
 * Resumable pipeline job (ARCHITECTURE §3.3). Persisted so an app kill mid-OCR
 * resumes from the current stage instead of losing work. Stages advance forward
 * only; each is idempotent.
 */
export type JobStage = "ocr" | "metadata" | "categorise" | "done";

export interface PipelineJob {
  id: string;
  docId: string;
  stage: JobStage;
  attempts: number;
  /** set when OCR confidence < threshold; pauses auto-processing for user choice */
  awaitingUser: boolean;
}

export interface JobStore {
  save(job: PipelineJob): Promise<void>;
  get(id: string): Promise<PipelineJob | null>;
  /** jobs not yet done and not awaiting the user — the runnable queue */
  pending(): Promise<PipelineJob[]>;
  delete(id: string): Promise<void>;
}

/** Document metadata repository (encrypted SQLite on device). */
export interface DocRepo {
  insert(doc: VaultDocument): Promise<void>;
  update(doc: VaultDocument): Promise<void>;
  get(id: string): Promise<VaultDocument | null>;
  list(opts?: { includeDeleted?: boolean }): Promise<VaultDocument[]>;
  /** content hashes of live docs — for duplicate detection */
  liveContentHashes(): Promise<Set<string>>;
  /** count of live (non-deleted) docs — for the free-tier cap */
  liveCount(): Promise<number>;
  /** permanent removal of the record (after crypto-shred + grace) */
  hardDelete(id: string): Promise<void>;
}
