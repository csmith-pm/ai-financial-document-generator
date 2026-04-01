# Document Engine

Standalone multi-agent document generation engine with pluggable document types. Built as a fully decoupled, provider-based architecture that ships with budget-book and PAFR as registered document types.

## Development Process

Always follow the development process documented in [dev_process.md](./dev_process.md). Key points:

- **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `chore:`, `test:`, `refactor:`, etc. Scope is encouraged (e.g., `feat(api): add health check endpoint`).
- **Branching**: Each milestone gets a feature branch (`feature/m8-api`). Merge via PR only — no direct pushes to `main`.
- **Testing**: Vitest for all tests. Tests organized by milestone in `tests/milestone-*/`. Every major piece of work includes tests. All tests must pass before opening a PR.
- **Code quality**: TypeScript strict mode, no `any` types, ESM throughout.
- **PR checklist**: Tests pass, zero type errors (`pnpm tsc --noEmit`), no secrets committed.

## Architecture

### Document Type System
Document types are self-contained modules registered at startup via `DocumentTypeDefinition<T>` interface (`src/core/doc-type.ts`):
- `id`, `name`, `version` — identity
- `dataSchema` — Zod schema for runtime validation
- `sectionTypes` — section specs with parallelism flags
- `agents` — AI agent definitions (creator, reviewer, advisor)
- `reviewers` — reviewer specs with custom prompt builders
- `seedSkills`, `categoryPriority` — skill system config
- `detectDataGaps()`, `parseUpload()`, `renderPdf()`, `analyzePriorDocument()` — doc-type-specific logic

Registry pattern in `src/core/doc-type-registry.ts`: `register()`, `get(id)`, `has(id)`, `list()`.

### Provider Pattern
All infrastructure is abstracted behind provider interfaces defined in `src/core/providers.ts`:
- **AiProvider** — `callText()`, `callJson<T>()`, `callVision()`, `logUsage?()`
- **StorageProvider** — `upload()`, `getObject()`, `getSignedUrl()`
- **DataProvider** — `getDocumentData(docTypeId, tenantId, worksheetId, fiscalYear)`
- **QueueProvider** — `enqueue()`, `process()`

Implementations: `AnthropicAiProvider`, `S3StorageProvider`, `LocalStorageProvider`, `ExcelDataProvider`, `BullMQQueueProvider`

### EngineContext
Internal context object passed through the orchestration pipeline (`src/core/context.ts`):
```typescript
{ db: DrizzleInstance, ai: AiProvider, storage: StorageProvider, data: DataProvider, tenantId: string, config: { maxIterations, chartsEnabled, defaultModel } }
```

### Pipeline System
Generic 14-step pipeline (`src/core/pipeline/`) that works with any registered document type:

1. **Seed Skills** — Load reusable writing guidelines from DB (idempotent)
2. **Analyze Prior Document** — Extract visual style (colors, fonts, layout) from prior-year PDF via vision API
3. **Index Prior Document** — Read cover, TOC, and content pages to build structured section map with page ranges
4. **Extract Prior Content** — For each indexed section, extract narrative text, tables, chart descriptions
5. **Merge Section List** — Combine doc type's standard sections with custom sections discovered in prior PDF
6. **Fetch Data** — Two-phase Excel parsing: AI maps columns (small call), code aggregates all rows programmatically
7. **Detect Data Gaps** — Compare required data vs. available data, create todos for missing items
8. **Generate Sections** — Creator agent generates content (narratives, tables, chart configs) per section
9. **Compose Sections** — Composer agent produces LayoutSpec per section, referencing Component Library
10. **Render Charts** — Puppeteer + Recharts → PNG (skipped when Composer active)
11. **Review & Iterate** — GFOA/ADA reviewers score output, Creator revises, skills extracted (loop with plateau detection)
12. **Render Output** — Assemble final PDF (from LayoutSpec or legacy @react-pdf path)
13. **Finalize** — Set status based on open todos

### Component Library
Pluggable visual component system (`src/core/components/`):
- **ComponentRegistry** — register/get/has/list pattern (mirrors doc-type registry)
- **10 built-in components** — narrative-block, financial-table, bar-chart, pie-chart, line-chart, stacked-bar-chart, grouped-bar-chart, stat-card, cover-page, toc
- **ComponentDefinition** interface — `id`, `propsSchema` (Zod), `renderHtml()`, `renderPdf()`, `builtIn` flag
- **LayoutSpec** — declarative `{ componentId, props, order }[]` per section, produced by Composer agent
- **Component Creator** — AI generates new components on-the-fly for novel visuals (org charts, waterfall charts), persists to `visual_components` DB table for reuse
- **Direct DOM rendering** — UI preview renders components in the React tree (no iframes), ready for interactive editing

### Agent System
Five agent types in the generation pipeline:
- **Creator** — Financial content expert. Generates narratives, tables, chart data per section
- **Composer** — Layout architect. Produces LayoutSpecs referencing Component Library (~500 tokens/section vs ~5000 for raw HTML)
- **Component Creator** — Frontend code generator. Writes new components when library is missing something. On-demand only.
- **Reviewer(s)** — GFOA criteria scorer, ADA/WCAG accessibility checker. Condensed payloads (3K char cap, 3-row table samples)
- **Advisor** — Conversational agent for resolving data gaps via todo chat

### Prior Document Analysis
Three-stage pipeline for learning from prior-year PDFs:
- **Indexer** (`pdf/indexer.ts`) — Reads cover + TOC to build structured section map. Maps discovered sections to standard types.
- **Extractor** (`pdf/extractor.ts`) — For each indexed section, extracts narrative, tables, chart descriptions via vision API
- **Rewriter pattern** — Creator rewrites from prior content + new financial data instead of generating from scratch

### Eval System
Automated evaluation framework (`evals/`):
- `evals/run.ts` — End-to-end test runner that executes full pipeline against fixture data
- `evals/fixtures/bristol-fy27/` — Bristol CT FY2027 budget book fixture (Excel + prior PDF)
- Produces markdown report with: pipeline execution, review scores, document comparison, grade (A-F), recommendations

### Self-Improving Skill System
Skills are extracted from reviews and injected into agent prompts (`src/core/skills/`):
- Max 15 skills per prompt, max 30 per agent+tenant
- Priority hierarchy configurable per doc type
- Customer-scoped skills override global seeds

### Key Naming Conventions
- `tenantId` (not `customerId`) — used throughout schema and code
- `docType` is required on all documents — no defaults
- Database schema is engine-owned in `src/db/schema.ts` (Drizzle ORM, no external FK references)

## Project Structure

- `src/core/` — Core engine logic (orchestrator, pipeline, skills, todos, doc-type registry)
- `src/core/pipeline/` — Generic 14-step pipeline
- `src/core/components/` — Component Library (registry, types, built-in components, creator)
- `src/core/skills/` — Skill arbitration, pruning, seeding
- `src/core/agents/` — Prompt builder (agent definitions live in doc types)
- `src/doc-types/` — Pluggable document type implementations
  - `budget-book/` — GFOA-compliant municipal budget books (creator, reviewers, sections, excel-parser, pdf/)
  - `pafr/` — Popular Annual Financial Reports
  - `shared/` — Shared agents (ADA reviewer, Composer agent)
- `src/db/` — Drizzle ORM schema and connection (engine-owned, uses `tenantId`)
- `src/providers/` — Provider implementations (Anthropic AI, S3, local storage, BullMQ, Excel data)
- `src/api/` — Fastify REST API (routes, validation, auth middleware)
- `src/api/middleware/auth.ts` — Extracts `tenantId`/`userId` from `x-tenant-id`/`x-user-id` headers
- `src/worker/` — BullMQ worker for async job processing
- `src/workbench/` — Dev-only CLI and routes for agent training
- `src/index.ts` — `createDocumentEngine()` factory and re-exports
- `evals/` — Evaluation test framework (run.ts, fixtures, reports)
- `tests/` — Milestone-organized test suites
- `tests/fixtures/` — Mock providers, sample data, sample review results
- `reference/` — Agent and skill specification documents

## Key Commands

```bash
pnpm test          # Run all tests (vitest)
pnpm tsc --noEmit  # Type-check (must be zero errors)
pnpm build         # Compile TypeScript
```

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/documents` | Create document |
| GET | `/api/documents` | List documents |
| GET | `/api/documents/:id` | Get document |
| DELETE | `/api/documents/:id` | Delete document |
| POST | `/api/documents/:id/data-file` | Upload data file |
| POST | `/api/documents/:id/prior-document` | Upload prior document |
| POST | `/api/documents/:id/generate` | Start generation |
| POST | `/api/documents/:id/regenerate` | Regenerate |
| GET | `/api/documents/:id/progress` | Job progress |
| GET | `/api/documents/:id/preview` | Web preview |
| GET | `/api/documents/:id/pdf` | Download PDF |
| GET | `/api/documents/:id/reviews` | Get reviews |
| GET | `/api/documents/:id/todos` | List todos |
| GET | `/api/documents/todos/:id` | Todo + messages |
| POST | `/api/documents/todos/:id/messages` | Chat with advisor |
| POST | `/api/documents/todos/:id/files` | Upload attachment |
| PATCH | `/api/documents/todos/:id/status` | Update status |
| GET | `/health` | Health check |

## Dependencies

Key runtime deps: `drizzle-orm`, `pg`, `fastify`, `@fastify/cors`, `@fastify/multipart`, `zod`, `@anthropic-ai/sdk`, `@aws-sdk/client-s3`, `@react-pdf/renderer`, `puppeteer`, `xlsx`, `bullmq`, `ioredis`, `recharts`

## Docker

`docker-compose.yml` defines 4 services: `api` (port 4000), `worker`, `postgres:16-alpine`, `redis:7-alpine`. Dockerfile uses multi-stage build with Chromium for Puppeteer chart rendering.
