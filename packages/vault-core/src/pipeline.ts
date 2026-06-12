/**
 * Ingestion pipeline (ARCHITECTURE §3.3, REQ-VAULT-001..011).
 *
 *   validate → hash → dedup → encrypt+persist → create record → enqueue job
 *   job: OCR → (confidence gate) → metadata extract → categorise → done
 *
 * OCR confidence < THRESHOLD pauses the job at `awaitingUser` and marks the doc
 * `manual_review` (REQ-VAULT-009). The user then either submits corrected text or
 * triggers the consent-gated cloud OCR fallback. The job is persisted at every
 * step, so an app kill mid-pipeline resumes from the saved stage.
 */

import { assertConsent, type ConsentToken } from "@vaultmind/consent";
import { DEFAULT_CATEGORY } from "./categories.js";
import { sha256Hex } from "./hashing.js";
import { validateUpload } from "./validation.js";
import type { VaultDocument } from "./model.js";
import type {
  Categoriser,
  Clock,
  DocRepo,
  IdProvider,
  JobStore,
  MetadataExtractor,
  OcrProvider,
  PipelineJob,
} from "./ports.js";
import { EncryptedFileStore } from "./fileStore.js";

/** Below this mean OCR confidence we flag for manual review (REQ-VAULT-009). */
export const OCR_CONFIDENCE_THRESHOLD = 0.7;
const MAX_ATTEMPTS = 3;

export interface IngestInput {
  bytes: Uint8Array;
  mimeType: string;
  pageCount: number;
  /** user-facing title (defaults to a generated one if omitted) */
  title?: string;
}

export interface IngestDeps {
  ids: IdProvider;
  clock: Clock;
  files: EncryptedFileStore;
  repo: DocRepo;
  jobs: JobStore;
  /** free-tier document cap (REQ-VAULT-022); omit for unlimited (paid). */
  maxLiveDocuments?: number;
}

export type IngestResult =
  | { ok: true; doc: VaultDocument; job: PipelineJob }
  | { ok: false; reason: "validation"; errors: string[] }
  | { ok: false; reason: "duplicate"; existingId: string }
  | { ok: false; reason: "limit_reached"; limit: number };

export async function ingestDocument(
  input: IngestInput,
  deps: IngestDeps
): Promise<IngestResult> {
  const v = validateUpload({
    mimeType: input.mimeType,
    sizeBytes: input.bytes.length,
    pageCount: input.pageCount,
  });
  if (!v.ok) return { ok: false, reason: "validation", errors: v.errors };

  if (deps.maxLiveDocuments !== undefined) {
    if ((await deps.repo.liveCount()) >= deps.maxLiveDocuments) {
      return { ok: false, reason: "limit_reached", limit: deps.maxLiveDocuments };
    }
  }

  const contentHash = sha256Hex(input.bytes);
  const existingHashes = await deps.repo.liveContentHashes();
  if (existingHashes.has(contentHash)) {
    const dup = (await deps.repo.list()).find((d) => d.contentHash === contentHash);
    return { ok: false, reason: "duplicate", existingId: dup ? dup.id : "" };
  }

  const id = deps.ids.newId();
  const now = deps.clock.now().toISOString();
  await deps.files.put(id, input.bytes);

  const doc: VaultDocument = {
    id,
    title: input.title?.trim() || `Document ${id}`,
    category: DEFAULT_CATEGORY,
    tags: [],
    mimeType: input.mimeType,
    sizeBytes: input.bytes.length,
    pageCount: input.pageCount,
    contentHash,
    metadata: {},
    ocr: { status: "pending" },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await deps.repo.insert(doc);

  const job: PipelineJob = {
    id: `job_${id}`,
    docId: id,
    stage: "ocr",
    attempts: 0,
    awaitingUser: false,
  };
  await deps.jobs.save(job);

  return { ok: true, doc, job };
}

// ---------------------------------------------------------------------------
// Job processing
// ---------------------------------------------------------------------------

export interface ProcessDeps {
  repo: DocRepo;
  jobs: JobStore;
  files: EncryptedFileStore;
  clock: Clock;
  deviceOcr: OcrProvider;
  metadata: MetadataExtractor;
  categoriser: Categoriser;
}

async function touch(repo: DocRepo, doc: VaultDocument, clock: Clock): Promise<void> {
  doc.updatedAt = clock.now().toISOString();
  await repo.update(doc);
}

/** Advance one job by exactly one stage. Idempotent and crash-safe. */
export async function processOnce(job: PipelineJob, deps: ProcessDeps): Promise<PipelineJob> {
  const doc = await deps.repo.get(job.docId);
  if (!doc) {
    const dead: PipelineJob = { ...job, stage: "done" };
    await deps.jobs.save(dead);
    return dead;
  }

  try {
    if (job.stage === "ocr") {
      doc.ocr.status = "processing";
      await touch(deps.repo, doc, deps.clock);

      const bytes = await deps.files.get(doc.id);
      const result = await deps.deviceOcr.recognize(bytes, doc.mimeType);
      doc.ocr = {
        status: result.confidence >= OCR_CONFIDENCE_THRESHOLD ? "done" : "manual_review",
        confidence: result.confidence,
        engine: result.engine,
        text: result.text,
      };
      await touch(deps.repo, doc, deps.clock);

      if (doc.ocr.status === "manual_review") {
        const paused: PipelineJob = { ...job, awaitingUser: true };
        await deps.jobs.save(paused);
        return paused;
      }
      const next: PipelineJob = { ...job, stage: "metadata", attempts: 0 };
      await deps.jobs.save(next);
      return next;
    }

    if (job.stage === "metadata") {
      doc.metadata = await deps.metadata.extract(doc.ocr.text ?? "");
      await touch(deps.repo, doc, deps.clock);
      const next: PipelineJob = { ...job, stage: "categorise", attempts: 0 };
      await deps.jobs.save(next);
      return next;
    }

    if (job.stage === "categorise") {
      const c = await deps.categoriser.classify(doc.ocr.text ?? "", doc.metadata);
      doc.category = c.category;
      await touch(deps.repo, doc, deps.clock);
      const next: PipelineJob = { ...job, stage: "done", attempts: 0 };
      await deps.jobs.save(next);
      await deps.jobs.delete(job.id); // completed jobs are removed from the queue
      return next;
    }

    return job; // already done
  } catch (e) {
    const attempts = job.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      doc.ocr.status = "failed";
      await touch(deps.repo, doc, deps.clock);
      const failed: PipelineJob = { ...job, attempts, awaitingUser: true };
      await deps.jobs.save(failed);
      return failed;
    }
    const retry: PipelineJob = { ...job, attempts };
    await deps.jobs.save(retry);
    throw e;
  }
}

/** Run a job to completion or until it pauses (manual review / failure). */
export async function drainJob(job: PipelineJob, deps: ProcessDeps): Promise<PipelineJob> {
  let cur = job;
  while (cur.stage !== "done" && !cur.awaitingUser) {
    cur = await processOnce(cur, deps);
  }
  return cur;
}

// ---------------------------------------------------------------------------
// Manual-review resolution (REQ-VAULT-009)
// ---------------------------------------------------------------------------

/** User-supplied corrected text after a low-confidence read. Resumes the pipeline. */
export async function submitManualText(
  docId: string,
  text: string,
  deps: ProcessDeps
): Promise<PipelineJob | null> {
  const doc = await deps.repo.get(docId);
  const job = await deps.jobs.get(`job_${docId}`);
  if (!doc || !job) return null;
  doc.ocr = { status: "done", confidence: 1, engine: doc.ocr.engine ?? "tesseract", text };
  await touch(deps.repo, doc, deps.clock);
  const resumed: PipelineJob = { ...job, stage: "metadata", awaitingUser: false, attempts: 0 };
  await deps.jobs.save(resumed);
  return drainJob(resumed, deps);
}

/**
 * Consent-gated cloud OCR fallback (Google Vision). Requires a ConsentToken for
 * `cloud_ocr_fallback` — the type forces the caller through the consent gate.
 */
export async function runCloudOcrFallback(
  docId: string,
  cloudOcr: OcrProvider,
  token: ConsentToken,
  deps: ProcessDeps
): Promise<PipelineJob | null> {
  assertConsent(token, "cloud_ocr_fallback");
  const doc = await deps.repo.get(docId);
  const job = await deps.jobs.get(`job_${docId}`);
  if (!doc || !job) return null;

  const bytes = await deps.files.get(doc.id);
  const result = await cloudOcr.recognize(bytes, doc.mimeType);
  doc.ocr = { status: "done", confidence: result.confidence, engine: "cloud", text: result.text };
  await touch(deps.repo, doc, deps.clock);
  const resumed: PipelineJob = { ...job, stage: "metadata", awaitingUser: false, attempts: 0 };
  await deps.jobs.save(resumed);
  return drainJob(resumed, deps);
}
