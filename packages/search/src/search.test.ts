import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SearchIndex, rewriteQuery, type SearchDocument } from "./index.js";
import { nodeSqliteDriver } from "./node-driver.js";

function doc(p: Partial<SearchDocument> & { docId: string }): SearchDocument {
  return {
    title: "",
    text: "",
    tags: [],
    category: "Legal",
    createdAt: "2026-01-01T00:00:00.000Z",
    mime: "application/pdf",
    ...p,
  };
}

describe("rewriteQuery", () => {
  it("extracts a year, infers a category, and drops stopwords", () => {
    const q = rewriteQuery("show me my 2023 rent agreement");
    expect(q.year).toBe(2023);
    expect(q.categoryHint).toBe("Property");
    expect(q.terms).toContain("rent");
    expect(q.terms).not.toContain("my");
    expect(q.match).toContain("rent*");
  });
  it("returns a null match for an empty / stopword-only query", () => {
    expect(rewriteQuery("show me all").match).toBeNull();
  });
});

describe("SearchIndex (FTS5)", () => {
  let idx: SearchIndex;
  beforeEach(() => { idx = new SearchIndex(nodeSqliteDriver); });
  afterEach(() => idx.close());

  it("finds a document by a body term", () => {
    idx.upsert(doc({ docId: "1", title: "Lekki Lease", text: "tenancy agreement for a flat", category: "Property" }));
    idx.upsert(doc({ docId: "2", title: "Passport", text: "international passport", category: "Identity" }));
    const hits = idx.search("tenancy");
    expect(hits[0]!.docId).toBe("1");
  });

  it("stems plurals (porter): 'agreements' matches 'agreement'", () => {
    idx.upsert(doc({ docId: "1", text: "this agreement is binding" }));
    expect(idx.search("agreements").length).toBe(1);
  });

  it("boosts the inferred category", () => {
    // same term in two docs; the Property one should win on a 'rent' query
    idx.upsert(doc({ docId: "prop", title: "Rent", text: "annual rent due", category: "Property" }));
    idx.upsert(doc({ docId: "leg", title: "Note", text: "mentions rent once", category: "Legal" }));
    const hits = idx.search("rent");
    expect(hits[0]!.docId).toBe("prop");
  });

  it("ranks a title hit above a body-only hit", () => {
    idx.upsert(doc({ docId: "title", title: "WAEC Certificate", text: "body", category: "Education" }));
    idx.upsert(doc({ docId: "body", title: "Misc", text: "a waec certificate copy", category: "Education" }));
    const hits = idx.search("waec");
    expect(hits[0]!.docId).toBe("title");
  });

  it("applies the year boost from the document date", () => {
    idx.upsert(doc({ docId: "2023", title: "Lease", text: "tenancy", category: "Property", docDate: "2023-05-01" }));
    idx.upsert(doc({ docId: "2025", title: "Lease", text: "tenancy", category: "Property", docDate: "2025-05-01" }));
    const hits = idx.search("2023 tenancy");
    expect(hits[0]!.docId).toBe("2023");
  });

  it("filters by category, date range, and mime", () => {
    idx.upsert(doc({ docId: "a", text: "report", category: "Health", docDate: "2026-03-01", mime: "image/png" }));
    idx.upsert(doc({ docId: "b", text: "report", category: "Legal", docDate: "2020-03-01", mime: "application/pdf" }));
    expect(idx.search("report", { category: "Health" }).map((h) => h.docId)).toEqual(["a"]);
    expect(idx.search("report", { dateFrom: "2025-01-01" }).map((h) => h.docId)).toEqual(["a"]);
    expect(idx.search("report", { mime: "application/pdf" }).map((h) => h.docId)).toEqual(["b"]);
  });

  it("browse mode (no terms) returns newest first honouring filters", () => {
    idx.upsert(doc({ docId: "old", category: "Legal", createdAt: "2026-01-01T00:00:00Z" }));
    idx.upsert(doc({ docId: "new", category: "Legal", createdAt: "2026-06-01T00:00:00Z" }));
    idx.upsert(doc({ docId: "other", category: "Health", createdAt: "2026-07-01T00:00:00Z" }));
    const hits = idx.search("", { category: "Legal" });
    expect(hits.map((h) => h.docId)).toEqual(["new", "old"]);
  });

  it("remove() drops a doc from results", () => {
    idx.upsert(doc({ docId: "1", text: "tenancy" }));
    idx.remove("1");
    expect(idx.search("tenancy")).toHaveLength(0);
  });

  it("meets the perf budget: 200 docs searched well under 2s (NFR-PERF-003)", () => {
    for (let i = 0; i < 200; i++) {
      idx.upsert(
        doc({
          docId: String(i),
          title: `Document ${i}`,
          text: `tenancy agreement number ${i} for a property in lagos lekki ${i % 7}`,
          category: i % 2 ? "Property" : "Legal",
          docDate: `202${i % 5}-0${(i % 9) + 1}-01`,
        })
      );
    }
    expect(idx.size()).toBe(200);
    const start = performance.now();
    const hits = idx.search("lekki tenancy", { category: "Property" });
    const elapsed = performance.now() - start;
    expect(hits.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(2000);
  });
});
