/**
 * The six top-level document categories (REQ-VAULT-010). Auto-assignment targets
 * one of these; users can override (REQ-VAULT-012) and add free-form sub-tags
 * (REQ-VAULT-013). Tuned to the Nigerian documents in the PRD/eval set.
 */

export const DOCUMENT_CATEGORIES = [
  "Identity", // passport, NIN slip, driver's licence, voter's card
  "Property", // tenancy agreement, C of O, deeds, utility/NEPA bills
  "Financial", // bank statements, insurance policies, tax (TIN), receipts
  "Education", // WAEC/NECO, degree certificates, transcripts
  "Legal", // contracts, agreements, affidavits, court documents
  "Health", // medical reports, vaccination cards, prescriptions
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export function isDocumentCategory(x: string): x is DocumentCategory {
  return (DOCUMENT_CATEGORIES as readonly string[]).includes(x);
}

/** Safe fallback when the classifier is unsure or returns something unexpected. */
export const DEFAULT_CATEGORY: DocumentCategory = "Legal";
