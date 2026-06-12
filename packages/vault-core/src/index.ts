/**
 * @vaultmind/vault-core — Smart Document Vault domain logic (PRD Phase 1).
 * Pure/orchestration code; native adapters (Tesseract, SLM, expo-sqlite,
 * encrypted file store) are injected via the ports in ./ports.ts.
 */

export {
  DOCUMENT_CATEGORIES,
  DEFAULT_CATEGORY,
  isDocumentCategory,
  type DocumentCategory,
} from "./categories.js";
export type {
  VaultDocument,
  ExtractedMetadata,
  OcrState,
  OcrStatus,
  OcrEngine,
  SortKey,
  SortDir,
} from "./model.js";
export {
  validateUpload,
  MAX_SIZE_BYTES,
  MAX_PAGES,
  ALLOWED_MIME_TYPES,
  type AllowedMimeType,
  type UploadCandidate,
  type ValidationResult,
} from "./validation.js";
export { sha256Hex, isDuplicate } from "./hashing.js";
export * from "./ports.js";
export { EncryptedFileStore } from "./fileStore.js";
export {
  InMemoryBlobStore,
  InMemoryDocRepo,
  InMemoryJobStore,
  sequentialIdProvider,
  fixedClock,
} from "./adapters.js";
export {
  ingestDocument,
  processOnce,
  drainJob,
  submitManualText,
  runCloudOcrFallback,
  OCR_CONFIDENCE_THRESHOLD,
  type IngestInput,
  type IngestDeps,
  type IngestResult,
  type ProcessDeps,
} from "./pipeline.js";
export {
  renameDocument,
  setNotes,
  setCategory,
  addTag,
  removeTag,
  sortDocuments,
  softDeleteDocument,
  undoDelete,
  purgeExpiredDeletions,
  DELETE_GRACE_DAYS,
} from "./management.js";
export { FREE_TIER_DOCUMENT_CAP, capStatus, type CapStatus } from "./limits.js";
