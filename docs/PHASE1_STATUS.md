# Phase 1 — Smart Document Vault: Status

**Branch:** `claude/phase-0-foundations` (continues from Phase 0)
**Plan reference:** `docs/IMPLEMENTATION_PLAN.md` → Phase 1 (Weeks 4–7).
**Exit criteria (PRD):** upload a document, have it auto-categorised, find it via search.

As in Phase 0: domain logic is **built and tested**; native/AI pieces (Tesseract, the SLM, the camera/file pickers, the Expo UI) are **injected via interfaces** with in-memory adapters standing in for tests, per your "interfaces + stubs + notes" choice.

## What runs and is tested now (Node/TypeScript)

| Capability | Where | Maps to |
|---|---|---|
| Upload validation (type, ≤25 MB, ≤50 pp) | `vault-core/validation.ts` | REQ-VAULT-002/003 |
| SHA-256 content hash + duplicate rejection | `vault-core/hashing.ts`, pipeline | REQ-VAULT-005 |
| Encrypted file store (per-file DEK, crypto-shred) over `@vaultmind/crypto` | `vault-core/fileStore.ts` | §3.2, REQ-VAULT-020 |
| Ingestion pipeline: validate → encrypt+persist → OCR → metadata → categorise | `vault-core/pipeline.ts` | REQ-VAULT-001/006/007/010 |
| OCR confidence gate → manual-review pause; corrected-text resume | `vault-core/pipeline.ts` | REQ-VAULT-009 |
| Consent-gated cloud OCR fallback (needs a `ConsentToken`) | `vault-core/pipeline.ts` + `@vaultmind/consent` | REQ-VAULT-006, §1.3 |
| Resumable job queue (crash-safe, stage-by-stage) | `vault-core/pipeline.ts`, `ports.ts` | §3.3 |
| Six-category model + manual override + tags | `vault-core/categories.ts`, `management.ts` | REQ-VAULT-010..013 |
| Rename, notes, sort | `vault-core/management.ts` | REQ-VAULT-012/016 |
| Delete: 7-day undo grace → crypto-shred purge | `vault-core/management.ts` | REQ-VAULT-018..021 |
| Free-tier 50-doc cap + upgrade signal | `vault-core/limits.ts`, pipeline | REQ-VAULT-022 |
| Plain-English search: query rewrite (year/category/stopwords) | `search/query.ts` | REQ-VAULT-014 |
| FTS5 index, BM25 ranking + category/recency/year boosts, filters, browse mode | `search/index.ts` | REQ-VAULT-014..017, NFR-PERF-003 |

**Test counts:** 71 total across the monorepo — vault-core 12, search 11, crypto 16, validation 20, consent 7, backend 5.

```bash
npm test          # NODE_OPTIONS=--experimental-sqlite is set by the script
npm run typecheck
```

### Notes on the search engine
`@vaultmind/search` runs real SQLite FTS5 via Node's built-in `node:sqlite` (loaded with `--experimental-sqlite`; the CI workflow sets this). The **same SQL** runs on `expo-sqlite` on device — only the DB-handle creation differs, so the on-device adapter is a thin swap behind the `SqliteDb` shape. The 200-document perf fixture asserts search well under the 2 s budget (NFR-PERF-003).

## Interfaces + stubs (need device / native runtime)

- **OCR** (`OcrProvider`) — device adapter = `react-native-tesseract-ocr` with deskew/binarise preprocessing; cloud adapter = Google Vision via `/api/ocr/fallback`. Tests use mocks.
- **Metadata extraction + categorisation** (`MetadataExtractor`, `Categoriser`) — device adapter = the **SLM** via `llama.rn` with GBNF-constrained JSON (DECISIONS #3). Tests use deterministic mocks; the 100-doc labelled eval set (PLAN week 6) is the real quality gate.
- **File store / repo / job store** — in-memory adapters here; device = `expo-file-system` (encrypted blobs) + `expo-sqlite` (encrypted metadata DB + job queue).
- **UI** — camera/gallery/file pickers, upload progress, metadata review screen, dashboard, and the 3-taps audit are Expo work on a dev machine.
- **Compression rendition** for low-storage devices — an interface concern at persistence time; not implemented in the pure-logic layer.

## Phase 1 exit checklist (PRD)

- [x] Upload + validation + dedup + encrypted persistence (logic)
- [x] OCR orchestration with confidence gate + consent-gated fallback (logic; engines mocked)
- [x] Auto-categorisation into six categories + override + tags (logic; SLM mocked)
- [x] Offline search that finds an uploaded document, with ranking + filters (real FTS5)
- [x] Management + delete/crypto-shred lifecycle + free-tier cap
- [ ] Tesseract + SLM adapters wired and benchmarked on a 2022 mid-range Android
- [ ] 100-doc categorisation eval set ≥ quality gate
- [ ] Expo UI (capture → review → dashboard → search), 3-taps audit
- [ ] `expo-sqlite` / `expo-file-system` adapters in place of the in-memory ones

The unchecked items need the native toolchain, a device, and the labelled eval set — exactly the work that can't run in a pure Node/TS sandbox. Everything checkable here is done and green: **upload → auto-categorise → find via search is logic-complete and tested end-to-end** with mocked engines.
