import { describe, it, expect, beforeEach } from "vitest";
import { generateLocalMasterKey, utf8ToBytes, bytesToUtf8 } from "@vaultmind/crypto";
import { ConsentRegistry } from "@vaultmind/consent";
import {
  ingestDocument,
  drainJob,
  processOnce,
  submitManualText,
  runCloudOcrFallback,
  EncryptedFileStore,
  InMemoryBlobStore,
  InMemoryDocRepo,
  InMemoryJobStore,
  sequentialIdProvider,
  fixedClock,
  validateUpload,
  sha256Hex,
  renameDocument,
  setCategory,
  addTag,
  sortDocuments,
  softDeleteDocument,
  undoDelete,
  purgeExpiredDeletions,
  capStatus,
  type IngestDeps,
  type ProcessDeps,
  type OcrProvider,
  type MetadataExtractor,
  type Categoriser,
} from "./index.js";

const PDF = "application/pdf";

// --- mock native/AI adapters ---
function ocrMock(text: string, confidence: number): OcrProvider {
  return { async recognize() { return { text, confidence, engine: "tesseract" as const }; } };
}
const cloudOcr: OcrProvider = {
  async recognize() {
    return { text: "clean cloud-recognised tenancy agreement text", confidence: 0.95, engine: "cloud" as const };
  },
};
const metadataMock: MetadataExtractor = {
  async extract(text) {
    return {
      issuer: text.includes("lagos") ? "Lagos State" : "Unknown",
      documentDate: "2026-01-15",
      ...(text.includes("expires") ? { expiryDate: "2027-01-15" } : {}),
    };
  },
};
const categoriserMock: Categoriser = {
  async classify(text) {
    if (text.includes("tenancy")) return { category: "Property", confidence: 0.9 };
    if (text.includes("passport")) return { category: "Identity", confidence: 0.95 };
    return { category: "Legal", confidence: 0.5 };
  },
};

function makeDeps() {
  const blobs = new InMemoryBlobStore();
  const files = new EncryptedFileStore(blobs, generateLocalMasterKey());
  const repo = new InMemoryDocRepo();
  const jobs = new InMemoryJobStore();
  const clock = fixedClock();
  const ingest: IngestDeps = { ids: sequentialIdProvider, clock, files, repo, jobs };
  const process: ProcessDeps = {
    repo, jobs, files, clock,
    deviceOcr: ocrMock("a clear tenancy agreement for lagos", 0.92),
    metadata: metadataMock,
    categoriser: categoriserMock,
  };
  return { blobs, files, repo, jobs, clock, ingest, process };
}

const bytesOf = (s: string) => utf8ToBytes(s);

describe("upload validation", () => {
  it("rejects oversized, overlong, and wrong-type files", () => {
    expect(validateUpload({ mimeType: "text/plain", sizeBytes: 10, pageCount: 1 }).ok).toBe(false);
    expect(validateUpload({ mimeType: PDF, sizeBytes: 26 * 1024 * 1024, pageCount: 1 }).ok).toBe(false);
    expect(validateUpload({ mimeType: PDF, sizeBytes: 10, pageCount: 51 }).ok).toBe(false);
    expect(validateUpload({ mimeType: PDF, sizeBytes: 10, pageCount: 3 }).ok).toBe(true);
  });
});

describe("ingestion happy path", () => {
  let d: ReturnType<typeof makeDeps>;
  beforeEach(() => { d = makeDeps(); });

  it("ingests, encrypts the file, OCRs, extracts metadata, and categorises", async () => {
    const res = await ingestDocument({ bytes: bytesOf("tenancy lagos"), mimeType: PDF, pageCount: 2 }, d.ingest);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const done = await drainJob(res.job, d.process);
    expect(done.stage).toBe("done");

    const doc = await d.repo.get(res.doc.id);
    expect(doc!.ocr.status).toBe("done");
    expect(doc!.ocr.text).toContain("tenancy");
    expect(doc!.category).toBe("Property");
    expect(doc!.metadata.issuer).toBe("Lagos State");

    // bytes are recoverable and were stored encrypted (blob != plaintext)
    expect(bytesToUtf8(await d.files.get(res.doc.id))).toBe("tenancy lagos");
    const rawBlob = await d.blobs.get(res.doc.id);
    expect(bytesToUtf8(rawBlob).includes("tenancy")).toBe(false);

    // completed job removed from the queue
    expect(await d.jobs.pending()).toHaveLength(0);
  });

  it("computes a stable content hash and rejects duplicates", async () => {
    const bytes = bytesOf("passport scan");
    const a = await ingestDocument({ bytes, mimeType: PDF, pageCount: 1 }, d.ingest);
    expect(a.ok).toBe(true);
    const b = await ingestDocument({ bytes, mimeType: PDF, pageCount: 1 }, d.ingest);
    expect(b.ok).toBe(false);
    if (!b.ok && b.reason === "duplicate") expect(b.existingId).toBe((a as any).doc.id);
    expect(sha256Hex(bytes)).toBe(sha256Hex(bytes));
  });
});

describe("free-tier cap (REQ-VAULT-022)", () => {
  it("blocks ingest at the cap with a clear reason", async () => {
    const d = makeDeps();
    const capped: IngestDeps = { ...d.ingest, maxLiveDocuments: 2 };
    await ingestDocument({ bytes: bytesOf("one"), mimeType: PDF, pageCount: 1 }, capped);
    await ingestDocument({ bytes: bytesOf("two"), mimeType: PDF, pageCount: 1 }, capped);
    const third = await ingestDocument({ bytes: bytesOf("three"), mimeType: PDF, pageCount: 1 }, capped);
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.reason).toBe("limit_reached");
  });

  it("capStatus signals upgrade as the cap approaches", () => {
    expect(capStatus(50).atCap).toBe(true);
    expect(capStatus(46).shouldPromptUpgrade).toBe(true);
    expect(capStatus(10).shouldPromptUpgrade).toBe(false);
  });
});

describe("low-confidence OCR -> manual review (REQ-VAULT-009)", () => {
  it("pauses for the user, and corrected text resumes the pipeline", async () => {
    const d = makeDeps();
    d.process.deviceOcr = ocrMock("blurry ???", 0.4);
    const res = await ingestDocument({ bytes: bytesOf("blurry tenancy"), mimeType: PDF, pageCount: 1 }, d.ingest);
    if (!res.ok) throw new Error("ingest failed");

    const paused = await drainJob(res.job, d.process);
    expect(paused.awaitingUser).toBe(true);
    expect((await d.repo.get(res.doc.id))!.ocr.status).toBe("manual_review");

    const resumed = await submitManualText(res.doc.id, "a clear tenancy agreement", d.process);
    expect(resumed!.stage).toBe("done");
    expect((await d.repo.get(res.doc.id))!.category).toBe("Property");
  });

  it("cloud OCR fallback requires consent, then completes", async () => {
    const d = makeDeps();
    d.process.deviceOcr = ocrMock("blurry ???", 0.3);
    const res = await ingestDocument({ bytes: bytesOf("blurry"), mimeType: PDF, pageCount: 1 }, d.ingest);
    if (!res.ok) throw new Error("ingest failed");
    await drainJob(res.job, d.process);

    const consent = new ConsentRegistry({ appVersion: "1.0.0" });
    expect(() => consent.mintToken("cloud_ocr_fallback")).toThrow(); // not granted yet
    consent.grant("cloud_ocr_fallback");
    const token = consent.mintToken("cloud_ocr_fallback");

    const done = await runCloudOcrFallback(res.doc.id, cloudOcr, token, d.process);
    expect(done!.stage).toBe("done");
    const doc = await d.repo.get(res.doc.id);
    expect(doc!.ocr.engine).toBe("cloud");
    expect(doc!.category).toBe("Property");
  });
});

describe("resumable job queue (ARCHITECTURE §3.3)", () => {
  it("resumes from the saved stage after an interruption", async () => {
    const d = makeDeps();
    const res = await ingestDocument({ bytes: bytesOf("tenancy"), mimeType: PDF, pageCount: 1 }, d.ingest);
    if (!res.ok) throw new Error("ingest failed");

    // process exactly one stage (OCR), then "crash"
    const afterOcr = await processOnce(res.job, d.process);
    expect(afterOcr.stage).toBe("metadata");

    // a fresh run picks the job up from the store and finishes it
    const [pending] = await d.jobs.pending();
    const done = await drainJob(pending!, d.process);
    expect(done.stage).toBe("done");
    expect((await d.repo.get(res.doc.id))!.category).toBe("Property");
  });
});

describe("management + deletion lifecycle", () => {
  async function seedDone() {
    const d = makeDeps();
    const res = await ingestDocument({ bytes: bytesOf("tenancy lagos"), mimeType: PDF, pageCount: 1 }, d.ingest);
    if (!res.ok) throw new Error("ingest failed");
    await drainJob(res.job, d.process);
    return { d, id: res.doc.id };
  }

  it("renames, overrides category, adds tags", async () => {
    const { d, id } = await seedDone();
    await renameDocument(d.repo, d.clock, id, "My Lekki Lease");
    await setCategory(d.repo, d.clock, id, "Legal");
    await addTag(d.repo, d.clock, id, "Lekki");
    const doc = await d.repo.get(id);
    expect(doc!.title).toBe("My Lekki Lease");
    expect(doc!.category).toBe("Legal");
    expect(doc!.tags).toContain("lekki");
  });

  it("sorts by title ascending", () => {
    const now = "2026-06-01T00:00:00.000Z";
    const mk = (t: string) => ({ title: t, createdAt: now, updatedAt: now, metadata: {} }) as any;
    const sorted = sortDocuments([mk("Zebra"), mk("Apple"), mk("Mango")], "title", "asc");
    expect(sorted.map((d) => d.title)).toEqual(["Apple", "Mango", "Zebra"]);
  });

  it("soft-delete hides the doc, undo restores it within grace", async () => {
    const { d, id } = await seedDone();
    await softDeleteDocument(d.repo, d.clock, id);
    expect(await d.repo.liveCount()).toBe(0);
    await undoDelete(d.repo, d.clock, id);
    expect(await d.repo.liveCount()).toBe(1);
  });

  it("purges after the grace window and crypto-shreds the file", async () => {
    const { d, id } = await seedDone();
    await softDeleteDocument(d.repo, d.clock, id);
    expect(await d.blobs.has(id)).toBe(true);

    // clock that is 8 days ahead of the fixed-clock deletion time
    const later = { now: () => new Date(Date.parse("2026-06-20T00:00:00.000Z")) };
    const purged = await purgeExpiredDeletions(d.repo, d.files, later, 7);
    expect(purged).toContain(id);
    expect(await d.blobs.has(id)).toBe(false); // shredded
    expect(await d.repo.get(id)).toBeNull();
  });
});
