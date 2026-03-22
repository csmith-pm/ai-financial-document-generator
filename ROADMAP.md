# Budget Book Engine → Multi-Document Engine Roadmap

## Project Vision

Restructuring the budget-book-engine from a single-purpose budget book generator into a **multi-document-type engine** that can generate any municipal financial document (budget books, ACFRs, PAFRs, K-1s, etc.). The engine uses a two-layer architecture: a generic core (`src/core/`) with pipeline executor, skill system, and provider interfaces, plus pluggable document types (`src/doc-types/`) that define sections, agents, reviewers, and rendering.

---

## Phase Status

| Phase | Name | Status | Branch | PR | Summary |
|-------|------|--------|--------|----|---------|
| 0 | Runnable Entry Points | ✅ Done | `feature/phase-0-entry-points` | #1 merged | `src/bin/server.ts`, `src/bin/worker.ts`, health endpoint |
| 1 | Generic Schema | ✅ Done | `feature/phase-1-generic-schema` | #2 merged | Renamed `budget_book_*` tables → `document_*`, enums → text |
| 2 | DocumentTypeDefinition + Extraction | ✅ Done | `feature/phase-2-doc-type-interface` | #3 merged | `DocumentTypeDefinition` interface, `DocumentTypeRegistry`, extracted budget-book into `src/doc-types/budget-book/` |
| 3 | Generic Orchestrator + Pipeline | ✅ Done | `feature/phase-3-generic-pipeline` | #4 merged | 873-line orchestrator → 9 pipeline steps, enriched `ReviewerSpec`, generic `orchestrateDocumentGeneration()` |
| 4 | Generic API + Entry Points | ✅ Done | `feature/phase-4-generic-api` | — | Generic `/api/documents` routes, `createDocumentEngine()` factory, generic worker jobs |
| 5 | Training Workbench | 🔲 Todo | `feature/phase-5-workbench` | — | Dev routes + CLI for agent training and iteration |
| 6 | Second Document Type | 🔲 Todo | `feature/phase-6-pafr` | — | Add PAFR (or similar) to validate abstraction end-to-end |

---

## Current State

- **Tests:** 296 passing
- **Type errors:** Zero (`npx tsc --noEmit`)
- **Next step:** Phase 5 — Training Workbench

---

## What Was Done (Completed Phases)

### Phase 0: Runnable Entry Points
- Created `src/bin/server.ts` and `src/bin/worker.ts` with env-based configuration
- Added `pnpm start` and `pnpm worker` scripts
- Health endpoint at `GET /health`

### Phase 1: Generic Schema
- Renamed all tables: `budget_books` → `documents`, `budget_book_sections` → `document_sections`, etc.
- Converted hardcoded enums (`section_type`, `reviewer_type`, `job_type`, `agent_type`) to `text` columns
- Added `doc_type` column to `documents` table
- Updated all 150+ tests and imports

### Phase 2: DocumentTypeDefinition + Extraction
- Defined `DocumentTypeDefinition` interface in `src/core/doc-type.ts`
- Created `DocumentTypeRegistry` in `src/core/doc-type-registry.ts`
- Extracted budget-book-specific code into `src/doc-types/budget-book/`:
  - `agents.ts` — 4 agent definitions (BB_Creator, BB_Reviewer, ADA_Reviewer, BB_Advisor)
  - `sections.ts` — Section types, data slicing, prompt construction
  - `reviewers.ts` — GFOA + ADA review specs
  - `seeds.ts` — 15 global seed skills
  - `detector.ts` — Data gap detection
  - `data.ts` — BudgetBookData types + Zod schema
  - `pdf.ts` — PDF renderer
  - `definition.ts` — `BudgetBookDocType` implementing the interface
- Registered budget-book in `src/doc-types/index.ts` via `defaultRegistry`

### Phase 3: Generic Orchestrator + Pipeline
- Created `src/core/pipeline/` with generic pipeline executor:
  - `types.ts` — `PipelineStep`, `PipelineContext`, `PipelineState`, `StepResult`
  - `executor.ts` — `runPipeline()`, `createInitialState()`, `updateBookStatus()`, `updateJobStatus()`
  - `index.ts` — `buildDefaultPipeline()` returning 9 ordered steps
- Created 9 pipeline steps in `src/core/pipeline/steps/`:
  - `seed-skills.ts`, `analyze-style.ts`, `fetch-data.ts`, `detect-gaps.ts`
  - `generate-sections.ts`, `render-charts.ts`, `review-and-iterate.ts`
  - `render-output.ts`, `finalize.ts`
- Enriched `ReviewerSpec` with 6 methods: `buildReviewPrompt`, `resultSchema`, `isPassed`, `getScore`, `getRecommendations`, `getFeedbackForSection`
- Added `storagePrefix`, `buildRevisionPrompt()`, `shouldContinueIterating()` to `DocumentTypeDefinition`
- Replaced 873-line `orchestrator.ts` with ~130-line thin wrapper
- Backward-compatible aliases: `orchestrateBudgetBookGeneration = orchestrateDocumentGeneration`
- 5 new test files in `tests/milestone-12/` (64 tests)

### Phase 4: Generic API + Entry Points
- Created generic `/api/documents` routes in `src/api/routes/documents.ts`:
  - CRUD: POST/GET/DELETE `/api/documents`, GET `/api/documents/:id`
  - Uploads: POST `/api/documents/:id/data-file`, `/api/documents/:id/prior-document`
  - Generation: POST `/api/documents/:id/generate`, `/api/documents/:id/regenerate`
  - Progress: GET `/api/documents/:id/progress`, `/preview`, `/pdf`, `/reviews`
  - Todos: GET `/api/documents/:documentId/todos`, todo CRUD under `/api/documents/todos/:id`
- S3 paths use `docType.storagePrefix` for proper namespacing
- Generate endpoint creates job rows from `buildDefaultPipeline()` step IDs (not hardcoded)
- Doc type validation on create: rejects unknown doc types
- Updated `src/api/server.ts` to register both generic and legacy routes
- Created generic validation schemas: `createDocumentSchema`, `documentIdParamSchema`, `documentIdWithTodoParamSchema`
- Kept `/api/books` routes as backward-compatible aliases
- `createDocumentEngine()` factory in `src/index.ts` (replaces `createBudgetBookEngine`, which is now an alias)
- Worker registers generic job names (`generate-document`, `regenerate-document`) + legacy names
- 3 new test files in `tests/milestone-13/` (24 tests)

---

## Remaining Phases

### Phase 5: Training Workbench
**Branch:** `feature/phase-5-workbench`
**Goal:** Dev-only routes + CLI for agent training and iteration inspection.

**Key features:**
- `POST /workbench/run-section` — generate a single section, inspect raw AI output
- `GET /workbench/iterations/:docId` — compare iterations side-by-side
- `GET /workbench/skills/:docType/:tenantId` — skill audit trail
- `POST /workbench/upload-test-data` — parse + validate without generating
- `GET /workbench/doc-types` — list registered types with configs
- CLI: `pnpm workbench run budget_book --data ./test.xlsx`

**Files to create:**
| File | Purpose |
|------|---------|
| `src/workbench/index.ts` | `createWorkbench()` — superset of production server |
| `src/workbench/routes/` | Dev-only route handlers |
| `src/workbench/cli.ts` | CLI entry point |
| `src/bin/workbench.ts` | Workbench binary |

### Phase 6: Second Document Type
**Branch:** `feature/phase-6-pafr`
**Goal:** Add a minimal second document type to validate the abstraction works end-to-end.

**What this proves:**
- A new doc type can be added by only creating files in `src/doc-types/<type>/`
- No changes needed in `src/core/` or pipeline steps
- Generic API routes work for the new type
- Skill system, review loop, and rendering are fully generic

---

## Key Files Reference

| File | Role |
|------|------|
| `src/core/doc-type.ts` | `DocumentTypeDefinition` interface — the contract every doc type implements |
| `src/core/doc-type-registry.ts` | `DocumentTypeRegistry` — runtime registry of available doc types |
| `src/core/pipeline/types.ts` | `PipelineStep`, `PipelineContext`, `PipelineState` interfaces |
| `src/core/pipeline/executor.ts` | `runPipeline()` — sequential step runner with error handling |
| `src/core/pipeline/index.ts` | `buildDefaultPipeline()` — returns the 9 ordered steps |
| `src/core/pipeline/steps/` | 9 individual step implementations |
| `src/core/orchestrator.ts` | Thin wrapper: loads doc, resolves type, runs pipeline |
| `src/core/providers.ts` | Provider interfaces (AI, Storage, Data, Queue) |
| `src/core/context.ts` | `EngineContext` — runtime context passed through pipeline |
| `src/core/agents/promptBuilder.ts` | Builds agent prompts with accumulated skills |
| `src/api/routes/documents.ts` | Generic `/api/documents` routes (any doc type) |
| `src/api/routes/books.ts` | Legacy `/api/books` routes (backward compat) |
| `src/api/routes/todos.ts` | Legacy `/api/todos` routes (backward compat) |
| `src/api/validation.ts` | Zod schemas for request validation |
| `src/doc-types/budget-book/` | Budget book doc type implementation |
| `src/doc-types/index.ts` | Registers all doc types, exports `defaultRegistry` |
| `src/db/schema.ts` | Drizzle ORM schema (generic `document_*` tables) |
| `src/index.ts` | Public API: `createDocumentEngine()`, exports |
| `src/worker/index.ts` | Job handlers (generic + legacy) |
| `CLAUDE.md` | Project documentation for AI assistants |
| `dev_process.md` | Development conventions (commits, branching, testing) |

## Pipeline Steps (in order)

The 9 default pipeline steps run sequentially:

1. **seed_skills** — Idempotent seeding of global skills from doc type
2. **analyze_prior_pdf** — Analyze prior-year document for style continuity
3. **fetch_data** — Load/parse document data (Excel upload or data provider)
4. **detect_gaps** — Detect data gaps → create todos for user
5. **generate_sections** — Generate all sections (parallel/sequential/structural batching)
6. **render_charts** — Render chart images (Puppeteer + Recharts) and persist sections
7. **review_and_iterate** — Review loop: run reviewers → check termination → revise → re-render (internal iteration)
8. **render_pdf** — Render final PDF (@react-pdf/renderer) and upload to storage
9. **finalize** — Set document status based on open todos

---

## Commands

```bash
npx vitest run              # Run all tests
npx tsc --noEmit            # Type-check (must be zero errors)
npx vitest run tests/milestone-13/  # Run specific milestone tests
```

## Conventions

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) with scope — `feat(pipeline):`, `refactor(doc-type):`, `test(api):`
- **Branches:** `feature/phase-N-description` per phase
- **PRs:** Merge to `main` via PR only. Include summary + test plan.
- **Tests:** Vitest, organized by milestone in `tests/milestone-*/`. All tests pass before PR.
- **TypeScript:** Strict mode, no `any`, ESM throughout.
- **No secrets:** Never commit `.env`, credentials, or API keys.
