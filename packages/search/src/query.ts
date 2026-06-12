/**
 * Plain-English query rewriting (REQ-VAULT-014). Turns "my 2023 rent agreement"
 * into an FTS5 MATCH expression plus structured hints (a year, an inferred
 * category) that the ranker uses to boost. Kept deliberately light — no embedding
 * model in MVP (ADR-001).
 */

const STOPWORDS = new Set([
  "the", "a", "an", "my", "for", "of", "in", "on", "to", "and", "is", "show",
  "me", "find", "where", "what", "with", "from", "all", "any",
]);

/** Words that hint at one of the six categories -> ranking boost. */
const CATEGORY_HINTS: Record<string, string> = {
  rent: "Property", tenancy: "Property", lease: "Property", landlord: "Property",
  nepa: "Property", utility: "Property", deed: "Property",
  passport: "Identity", nin: "Identity", license: "Identity", licence: "Identity",
  voter: "Identity", id: "Identity",
  bank: "Financial", statement: "Financial", insurance: "Financial", tax: "Financial",
  receipt: "Financial", invoice: "Financial",
  waec: "Education", neco: "Education", certificate: "Education", degree: "Education",
  transcript: "Education", school: "Education",
  contract: "Legal", agreement: "Legal", affidavit: "Legal", court: "Legal",
  medical: "Health", health: "Health", vaccination: "Health", prescription: "Health",
};

export interface RewrittenQuery {
  /** FTS5 MATCH string, or null for a browse (no text terms) */
  match: string | null;
  terms: string[];
  year?: number;
  /** inferred category to boost, if any term hinted at one */
  categoryHint?: string;
  raw: string;
}

export function rewriteQuery(input: string): RewrittenQuery {
  const raw = input.trim();
  const lower = raw.toLowerCase();

  const yearMatch = lower.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? Number(yearMatch[0]) : undefined;

  const tokens = lower
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);

  let categoryHint: string | undefined;
  const terms: string[] = [];
  for (const tok of tokens) {
    if (CATEGORY_HINTS[tok] && !categoryHint) categoryHint = CATEGORY_HINTS[tok];
    if (/^(19|20)\d{2}$/.test(tok)) continue; // year handled separately
    if (STOPWORDS.has(tok)) continue;
    if (tok.length < 2) continue;
    terms.push(tok);
  }

  // OR of prefix terms maximises recall; the ranker handles precision.
  const match = terms.length ? terms.map((t) => `${t}*`).join(" OR ") : null;

  return {
    match,
    terms,
    ...(year !== undefined ? { year } : {}),
    ...(categoryHint !== undefined ? { categoryHint } : {}),
    raw,
  };
}
