/**
 * Legal disclaimer (REQ-CONTRACT-009) — rendered prominently and non-dismissably on
 * every result, both tiers. ContractScan is an explainer, not legal advice.
 */

export const CONTRACTSCAN_DISCLAIMER =
  "ContractScan gives you a plain-English explanation to help you understand a " +
  "document. It is not legal advice and is not a substitute for a qualified lawyer. " +
  "For anything important, or if a clause is flagged, consult a legal professional " +
  "before you sign.";

export const VERDICT_LABEL: Record<string, string> = {
  standard: "Looks standard",
  review_before_signing: "Review carefully before signing",
  seek_legal_advice: "Consider getting legal advice",
};

export const SEVERITY_LABEL: Record<string, string> = {
  note: "Note",
  caution: "Caution",
  serious: "Serious",
};
