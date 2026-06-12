/**
 * The on-device document record (ARCHITECTURE §3.2/§3.3). Lives in encrypted
 * SQLite; the file bytes live in the encrypted file store. Nothing here goes to
 * the server (data minimisation, NFR-SEC-006).
 */

import type { DocumentCategory } from "./categories.js";

export type OcrStatus = "pending" | "processing" | "done" | "manual_review" | "failed";
export type OcrEngine = "tesseract" | "cloud";

export interface ExtractedMetadata {
  issuer?: string;
  /** the document's own date (issue date), ISO yyyy-mm-dd */
  documentDate?: string;
  /** expiry date if present — ExpiryGuard (Phase 2) consumes this */
  expiryDate?: string;
  /** e.g. { passportNumber: "A01234567", nin: "12345678901" } */
  identifiers?: Record<string, string>;
}

export interface OcrState {
  status: OcrStatus;
  /** 0..1 mean confidence from the OCR engine */
  confidence?: number;
  engine?: OcrEngine;
  /** recognised text — feeds the search index; never leaves the device */
  text?: string;
}

export interface VaultDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  tags: string[];
  mimeType: string;
  sizeBytes: number;
  pageCount: number;
  /** SHA-256 (hex) of the original bytes — duplicate detection (REQ-VAULT-005) */
  contentHash: string;
  notes?: string;
  metadata: ExtractedMetadata;
  ocr: OcrState;
  createdAt: string;
  updatedAt: string;
  /** soft-delete marker; null/absent = live. 7-day grace then crypto-shred. */
  deletedAt?: string | null;
}

export type SortKey = "createdAt" | "updatedAt" | "title" | "expiryDate";
export type SortDir = "asc" | "desc";
