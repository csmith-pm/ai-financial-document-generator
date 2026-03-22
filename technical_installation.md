# Budget Book Engine — Technical Installation & Usage Guide

## Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** (corepack-managed)
- **PostgreSQL** 16+
- **Redis** 7+
- **Anthropic API key** (Claude access)
- **AWS credentials** (for S3 storage) _or_ use the local filesystem storage provider for development

---

## 1. Installation

```bash
git clone <repo-url> budget-book-engine
cd budget-book-engine
corepack enable
pnpm install
```

### Environment Variables

Copy the example and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgresql://user:pass@localhost:5432/budgetbook`) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key (`sk-ant-...`) |
| `REDIS_URL` | Yes | Redis connection string (`redis://localhost:6379`) |
| `AWS_ACCESS_KEY_ID` | No | AWS credentials for S3 (not needed if using `LocalStorageProvider`) |
| `AWS_SECRET_ACCESS_KEY` | No | AWS credentials for S3 |
| `S3_BUCKET_REPORTS` | No | S3 bucket name (default: `my-bucket`) |
| `AWS_REGION` | No | AWS region (default: `us-east-1`) |
| `PORT` | No | API server port (default: `4000`) |
| `AI_MAX_TOKENS_PER_REQUEST` | No | Max tokens per AI call (default: `4096`) |

---

## 2. Database Setup

The engine owns its schema via Drizzle ORM. Push the schema to your database:

```bash
# Create the database first
createdb budgetbook

# Push the Drizzle schema to the database
pnpm db:push
```

Or generate and run SQL migrations:

```bash
pnpm db:generate   # Generate migration files into ./drizzle/
pnpm db:migrate    # Apply migrations
```

### Schema Overview

The engine manages 7 tables:

| Table | Purpose |
|-------|---------|
| `budget_books` | Top-level book records (title, fiscal year, status, config) |
| `budget_book_sections` | Generated section content (narrative, tables, charts) |
| `budget_book_reviews` | GFOA and ADA review results per iteration |
| `budget_book_jobs` | Job progress tracking for each generation step |
| `agent_skills` | Self-improving skill system (seeds + learned skills) |
| `budget_book_todos` | Action items from data gaps and review findings |
| `budget_book_todo_messages` | Chat history between users and the AI advisor |

All tables use `tenant_id` for multi-tenant isolation. No external foreign keys — the engine is fully self-contained.

---

## 3. Build & Verify

```bash
pnpm build          # Compile TypeScript → dist/
pnpm typecheck      # Type-check without emitting (must be zero errors)
pnpm test           # Run all 150 tests across 27 test files
pnpm check          # Typecheck + test in one command
```

---

## 4. Running the Service

### Option A: Docker Compose (recommended for production-like environments)

```bash
# Set required env vars
export ANTHROPIC_API_KEY=sk-ant-...
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...

docker compose up --build
```

This starts 4 services:

| Service | Port | Description |
|---------|------|-------------|
| `api` | 4000 | Fastify REST API |
| `worker` | — | BullMQ job processor (no exposed port) |
| `postgres` | 5432 | PostgreSQL 16 |
| `redis` | 6379 | Redis 7 |

### Option B: Local Development

Start the infrastructure:

```bash
# If you don't have Postgres/Redis running locally, use Docker for just those:
docker run -d --name bbengine-pg -p 5432:5432 \
  -e POSTGRES_USER=budgetbook -e POSTGRES_PASSWORD=budgetbook -e POSTGRES_DB=budgetbook \
  postgres:16-alpine

docker run -d --name bbengine-redis -p 6379:6379 redis:7-alpine
```

Push the schema and start the services:

```bash
pnpm db:push
pnpm build

# Terminal 1 — API server
pnpm start

# Terminal 2 — Background worker
pnpm worker
```

### Option C: Programmatic (embed in another app)

```typescript
import {
  createBudgetBookEngine,
  AnthropicAiProvider,
  S3StorageProvider,
  BullMQQueueProvider,
} from "@docgen/budget-book-engine";

const engine = createBudgetBookEngine({
  connectionString: process.env.DATABASE_URL!,
  ai: new AnthropicAiProvider(process.env.ANTHROPIC_API_KEY!),
  storage: new S3StorageProvider({
    bucket: process.env.S3_BUCKET!,
    region: process.env.AWS_REGION!,
  }),
  data: yourDataProvider,    // Implement the DataProvider interface
  queue: new BullMQQueueProvider(process.env.REDIS_URL!),
  maxIterations: 3,          // Review-revise cycles (default: 3)
  chartsEnabled: true,       // Puppeteer chart rendering (default: true)
  defaultModel: "claude-sonnet-4-20250514",
});

// Start the API server
const app = await engine.startServer(4000);

// Register the background worker
engine.startWorker();

// Or generate directly (bypasses the queue)
await engine.generate(budgetBookId, tenantId);

// Graceful shutdown
await engine.shutdown();
```

For local development without AWS, use `LocalStorageProvider`:

```typescript
import { LocalStorageProvider } from "@docgen/budget-book-engine";

const storage = new LocalStorageProvider("/tmp/budget-book-storage");
```

---

## 5. Authentication

The API uses header-based tenant identification. Every `/api/*` request must include:

| Header | Required | Description |
|--------|----------|-------------|
| `x-tenant-id` | Yes | Tenant/organization identifier |
| `x-user-id` | No | User identifier (defaults to `"unknown"`) |

Missing `x-tenant-id` returns `401 Unauthorized`.

In production, replace the auth middleware in `src/api/middleware/auth.ts` with JWT validation or your preferred auth strategy.

---

## 6. API Reference

Base URL: `http://localhost:4000`

### Health

```
GET /health
```

Returns `{ status: "ok", timestamp: "...", version: "..." }`. No auth required.

---

### Books

#### Create a Book

```
POST /api/books
Content-Type: application/json

{
  "title": "FY2026 Budget Book",
  "fiscalYear": 2026,
  "dataSource": "upload",        // "module" (query DataProvider) or "upload" (Excel file)
  "worksheetId": "ws-123",       // optional, for module data source
  "maxIterations": 3             // optional, 1–10, default 3
}
```

Returns `201` with the created book record.

#### List Books

```
GET /api/books
```

Returns all books for the authenticated tenant, ordered by creation date.

#### Get a Book

```
GET /api/books/:id
```

Returns the full book record or `404`.

#### Delete a Book

```
DELETE /api/books/:id
```

Returns `204` on success. Cascades to sections, reviews, jobs, and todos.

#### Upload Budget Excel File

```
POST /api/books/:id/budget-file
Content-Type: multipart/form-data

(attach Excel file as form field)
```

Uploads the file to storage and sets `dataSource` to `"upload"`. Max file size: 50 MB.

#### Upload Prior-Year PDF

```
POST /api/books/:id/prior-year-pdf
Content-Type: multipart/form-data

(attach PDF file as form field)
```

The engine analyzes this PDF to extract style guidance (tone, chart types, layout) for the new book.

#### Start Generation

```
POST /api/books/:id/generate
```

Enqueues the generation job. Returns `202 Accepted`. Only works from `"draft"` or `"failed"` status.

The worker picks up the job and runs the full orchestration pipeline:
1. Analyze prior-year PDF for style
2. Fetch/parse budget data
3. Detect data gaps and create todos
4. Generate all sections using BB_Creator agent
5. Render charts (Puppeteer + Recharts)
6. GFOA + ADA review in parallel
7. Extract learned skills from reviews
8. Revise sections based on feedback (with plateau detection)
9. Render final PDF
10. Set final status

#### Regenerate

```
POST /api/books/:id/regenerate
```

Re-runs generation after a user addresses todos. Works from `"completed"`, `"completed_with_todos"`, or `"failed"` status. Returns `202`.

#### Get Progress

```
GET /api/books/:id/progress
```

Returns job-level progress for real-time UI updates:

```json
{
  "budgetBookId": "...",
  "jobs": [
    { "jobType": "analyze_prior_pdf", "status": "completed", "progress": 100, "message": "Style analysis complete" },
    { "jobType": "generate_sections", "status": "running", "progress": 60, "message": "Generating personnel summary..." },
    { "jobType": "gfoa_review", "status": "pending", "progress": 0 }
  ]
}
```

Job types in order: `analyze_prior_pdf`, `generate_sections`, `render_charts`, `gfoa_review`, `ada_review`, `revise_sections`, `render_pdf`, `finalize`.

#### Get Preview

```
GET /api/books/:id/preview
```

Returns the book metadata and all section content for web rendering.

#### Download PDF

```
GET /api/books/:id/pdf
```

Redirects to a signed download URL for the generated PDF. Returns `404` if not yet generated.

#### Get Reviews

```
GET /api/books/:id/reviews
```

Returns all GFOA and ADA review results across iterations, ordered chronologically.

---

### Todos

Todos are created automatically during generation (from data gaps and GFOA review findings). Users can chat with the BB_Advisor agent to resolve them.

#### List Todos for a Book

```
GET /api/books/:bookId/todos
```

#### Get Todo with Messages

```
GET /api/todos/:id
```

Returns the todo record and its full chat message history.

#### Send a Message (Chat with Advisor)

```
POST /api/todos/:id/messages
Content-Type: application/json

{ "message": "Can you explain what revenue data is missing?" }
```

The BB_Advisor agent responds in context of the todo, the book, and prior chat history. Returns the agent's response.

#### Upload Attachment

```
POST /api/todos/:id/files
Content-Type: multipart/form-data

(attach file)
```

Returns `{ s3Key: "..." }`.

#### Update Todo Status

```
PATCH /api/todos/:id/status
Content-Type: application/json

{ "status": "resolved" }
```

Valid statuses: `open`, `in_progress`, `resolved`, `skipped`.

---

## 7. Implementing a Custom DataProvider

If you're integrating the engine into an existing application, implement the `DataProvider` interface to supply budget data from your system:

```typescript
import type { DataProvider, BudgetBookData } from "@docgen/budget-book-engine";

class MyDataProvider implements DataProvider {
  async getBudgetData(
    tenantId: string,
    worksheetId: string,
    fiscalYear: number
  ): Promise<BudgetBookData> {
    // Query your database, API, or data warehouse
    return {
      fiscalYear,
      communityProfile: {
        name: "Town of Springfield",
        state: "MA",
        population: 155000,
        squareMiles: 33.2,
        formOfGovernment: "Council-Manager",
        established: "1636",
      },
      revenueDetail: [
        {
          fundCode: "100",
          fundName: "General Fund",
          accountCode: "4100",
          accountName: "Property Tax",
          priorActual: 45000000,
          currentBudget: 47000000,
          proposedBudget: 49000000,
        },
        // ... more rows
      ],
      expenditureByDepartment: [ /* ... */ ],
      personnelDetail: [ /* ... */ ],
      capitalProjects: [ /* ... */ ],
      multiYearProjections: [ /* ... */ ],
      totalRevenue: 85000000,
      totalExpenditure: 82000000,
      totalPersonnelCost: 42000000,
      totalCapitalCost: 15000000,
      executiveSummary: "Optional pre-written summary text...",
    };
  }
}
```

Alternatively, use `dataSource: "upload"` to let users upload an Excel file, which the engine parses with Claude.

---

## 8. Book Lifecycle

```
draft → analyzing → generating → reviewing → revision → reviewing → ... → completed
                                                                          → completed_with_todos
                                                                          → failed
```

| Status | Meaning |
|--------|---------|
| `draft` | Created, awaiting file uploads and generation trigger |
| `analyzing` | Parsing prior-year PDF for style guidance |
| `generating` | AI agents are writing section content |
| `reviewing` | GFOA and ADA reviewers are evaluating the book |
| `revision` | BB_Creator is revising sections based on review feedback |
| `completed` | All reviews passed, PDF generated, no open todos |
| `completed_with_todos` | PDF generated but action items remain for the user |
| `failed` | An error occurred; can be retried with `/generate` |

The review-revise loop runs up to `maxIterations` times (default 3). It stops early if:
- Both GFOA and ADA reviews pass
- The GFOA score plateaus (no improvement between iterations)

---

## 9. Self-Improving Skill System

The engine learns from every generation cycle. After each review, it extracts "skills" — lessons learned — and injects them into future agent prompts.

- **15 global seed skills** are created on first run (idempotent)
- Skills extracted from reviews are scoped to the tenant
- Max **15 skills per prompt**, max **30 per agent+tenant combination**
- Priority hierarchy: ADA compliance > GFOA standards > formatting
- Tenant-scoped skills override global seeds when they conflict
- Low-confidence skills are pruned automatically

No configuration needed — this runs automatically as part of the orchestration pipeline.

---

## 10. Testing

```bash
pnpm test                            # Run all tests
pnpm test:watch                      # Watch mode
npx vitest run tests/milestone-8/    # Run a specific milestone's tests
```

Tests are organized by milestone in `tests/milestone-*/`. Test fixtures (mock providers, sample data) are in `tests/fixtures/`.

To run the pre-commit check:

```bash
pnpm check    # tsc --noEmit && vitest run
```

---

## 11. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ECONNREFUSED` on startup | Ensure Postgres and Redis are running and `DATABASE_URL`/`REDIS_URL` are correct |
| `relation "budget_books" does not exist` | Run `pnpm db:push` to create the schema |
| Chart rendering fails | Puppeteer needs Chromium. In Docker this is handled automatically. Locally, run `npx puppeteer browsers install chrome` |
| `401 Unauthorized` on API calls | Include `x-tenant-id` header in all `/api/*` requests |
| Generation stuck in `"generating"` | Check the worker process is running (`pnpm worker`). Check Redis connectivity. |
| `ANTHROPIC_API_KEY` errors | Verify the key is set and has sufficient credits |
| File upload returns `413` | Max upload size is 50 MB (configured in Fastify multipart) |
