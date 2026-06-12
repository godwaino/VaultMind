/**
 * Upload validation (REQ-VAULT-002/003). Enforced before anything is encrypted or
 * queued, so bad inputs never enter the pipeline.
 */

export const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_PAGES = 50;

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

export interface UploadCandidate {
  mimeType: string;
  sizeBytes: number;
  /** page count (1 for single images); validated against MAX_PAGES */
  pageCount: number;
}

export function validateUpload(c: UploadCandidate): ValidationResult {
  const errors: string[] = [];

  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(c.mimeType)) {
    errors.push("Unsupported file type. Use PDF, JPG, PNG, or Word (.docx).");
  }
  if (c.sizeBytes <= 0) {
    errors.push("File appears to be empty.");
  } else if (c.sizeBytes > MAX_SIZE_BYTES) {
    errors.push("File is larger than 25 MB.");
  }
  if (!Number.isInteger(c.pageCount) || c.pageCount < 1) {
    errors.push("Could not read the page count.");
  } else if (c.pageCount > MAX_PAGES) {
    errors.push("Document has more than 50 pages.");
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}
