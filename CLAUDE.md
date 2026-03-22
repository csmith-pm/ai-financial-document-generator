# Budget Book Engine

Standalone multi-agent document generation engine for GFOA-compliant municipal budget books. Rebuilt from a ClearGov monorepo extraction into a fully decoupled, provider-based architecture.

## Development Process

Always follow the development process documented in [dev_process.md](./dev_process.md). Key points:

- **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `chore:`, `test:`, `refactor:`, etc. Scope is encouraged (e.g., `feat(api): add health check endpoint`).
- **Branching**: Each milestone gets a feature branch (`feature/m8-api`). Merge via PR only — no direct pushes to `main`.
- **Testing**: Vitest for all tests. Tests organized by milestone in `tests/milestone-*/`. Every major piece of work includes tests. All tests must pass before opening a PR.
- **Code quality**: TypeScript strict mode, no `any` types, ESM throughout.
- **PR checklist**: Tests pass, zero type errors (`pnpm tsc --noEmit`), no secrets committed.

## Architecture

### Provider Pattern
All infrastructure is abstracted behind provider interfaces defined in `src/core/providers.ts`:
- **AiProvider** — `callText()`, `callJson<T>()`, `callVision()`, `logUsage?()`
- **StorageProvider** — `upload()`, `getObject()`, `getSignedUrl()`
- **DataProvider** — `getBudgetData()` (returns flat `BudgetBookData`)
- **QueueProvider** — `enqueue()`, `process()`

Implementations: `AnthropicAiProvider`, `S3StorageProvider`, `LocalStorageProvider`, `ExcelDataProvider`, `BullMQQueueProvider`

### EngineContext
Internal context object passed through the orchestration pipeline (`src/core/context.ts`):
```typescript
{ db: DrizzleInstance, ai: AiProvider, storage: StorageProvider, data: DataProvider, tenantId: string, config: { maxIterations, chartsEnabled, defaultModel } }
```

### Multi-Agent System
4 AI agents with distinct roles, defined in `src/core/agents/definitions.ts`:
- **BB_Creator** (t=0.4) — Generates section content
- **BB_Reviewer** (t=0.2) — GFOA compliance scoring (180-point scale)
- **ADA_Reviewer** (t=0.1) — WCAG 2.1 AA accessibility checks
- **BB_Advisor** (t=0.5) — Todo chat advisor

### Self-Improving Skill System
Skills are extracted from reviews and injected into agent prompts (`src/core/skills/`):
- Max 15 skills per prompt, max 30 per agent+tenant
- Priority hierarchy: ADA > GFOA > formatting
- Customer-scoped skills override global seeds

### Orchestration Flow (`src/core/orchestrator.ts`)
1. Seed global skills (idempotent)
2. Analyze prior-year PDF for style
3. Fetch budget data + detect data gaps (create todos)
4. Generate sections (parallel where independent)
5. Render charts (Puppeteer + Recharts)
6. GFOA + ADA review in parallel
7. Extract skills from reviews
8. Create quality todos from first GFOA review
9. Revise with plateau detection (stop if score doesn't improve by >2 points)
10. Render final PDF (@react-pdf/renderer)
11. Set status based on open todos

### Key Naming Conventions
- `tenantId` (not `customerId`) — used throughout schema and code
- `BudgetBookData` uses flat arrays: `revenueDetail`, `expenditureByDepartment`, `personnelDetail`, `capitalProjects`, `multiYearProjections` (not nested objects)
- Database schema is engine-owned in `src/db/schema.ts` (Drizzle ORM, no external FK references)

## Project Structure

- `src/core/` — Core business logic (orchestrator, agents, skills, todos, parsers, PDF rendering)
- `src/core/types.ts` — Shared types (e.g., `StyleAnalysis`) used across multiple modules
- `src/db/` — Drizzle ORM schema and connection (engine-owned, uses `tenantId`)
- `src/providers/` — Provider implementations (Anthropic AI, S3, local storage, BullMQ, Excel data)
- `src/api/` — Fastify REST API (routes, validation, auth middleware)
- `src/api/middleware/auth.ts` — Extracts `tenantId`/`userId` from `x-tenant-id`/`x-user-id` headers
- `src/worker/` — BullMQ worker for async job processing
- `src/index.ts` — `createBudgetBookEngine()` factory and re-exports
- `tests/` — Milestone-organized test suites (27 files, 150 tests)
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
| POST | `/api/books` | Create book |
| GET | `/api/books` | List books |
| GET | `/api/books/:id` | Get book |
| DELETE | `/api/books/:id` | Delete book |
| POST | `/api/books/:id/budget-file` | Upload Excel |
| POST | `/api/books/:id/prior-year-pdf` | Upload prior PDF |
| POST | `/api/books/:id/generate` | Start generation |
| POST | `/api/books/:id/regenerate` | Regenerate |
| GET | `/api/books/:id/progress` | Job progress |
| GET | `/api/books/:id/preview` | Web preview |
| GET | `/api/books/:id/pdf` | Download PDF |
| GET | `/api/books/:id/reviews` | Get reviews |
| GET | `/api/books/:bookId/todos` | List todos |
| GET | `/api/todos/:id` | Todo + messages |
| POST | `/api/todos/:id/messages` | Chat with advisor |
| POST | `/api/todos/:id/files` | Upload attachment |
| PATCH | `/api/todos/:id/status` | Update status |
| GET | `/health` | Health check |

## Dependencies

Key runtime deps: `drizzle-orm`, `pg`, `fastify`, `@fastify/cors`, `@fastify/multipart`, `zod`, `@anthropic-ai/sdk`, `@aws-sdk/client-s3`, `@react-pdf/renderer`, `puppeteer`, `xlsx`, `bullmq`, `ioredis`, `recharts`

## Docker

`docker-compose.yml` defines 4 services: `api` (port 4000), `worker`, `postgres:16-alpine`, `redis:7-alpine`. Dockerfile uses multi-stage build with Chromium for Puppeteer chart rendering.
