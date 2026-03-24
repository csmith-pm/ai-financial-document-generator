# Document Engine — Technical Installation & Usage Guide

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
git clone <repo-url> document-engine
cd document-engine
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
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgresql://user:pass@localhost:5432/docengine`) |
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
createdb docengine

# Push the Drizzle schema to the database
pnpm db:push
```

Or generate and run SQL migrations:

```bash
pnpm db:generate   # Generate migration files into ./drizzle/
pnpm db:migrate    # Apply migrations
```

### Schema Overview

The engine manages 9 tables:

| Table | Purpose |
|-------|---------|
| `documents` | Top-level document records (title, fiscal year, status, docType, config) |
| `document_sections` | Generated section content (narrative, tables, charts). Now includes a `layout_spec` JSONB column for Composer output |
| `document_reviews` | Review results per reviewer per iteration |
| `document_jobs` | Job progress tracking for each pipeline step |
| `agent_skills` | Self-improving skill system (seeds + learned skills) |
| `document_todos` | Action items from data gaps and review findings |
| `document_todo_messages` | Chat history between users and the AI advisor |
| `visual_components` | AI-generated component definitions (component_id, version, name, category, props_schema, render_html_source, render_pdf_source, tenant_id, built_in) |
| `section_layout_specs` | Layout specs per document section (document_id, section_type, layout_spec jsonb) |

All tables use `tenant_id` for multi-tenant isolation. No external foreign keys — the engine is fully self-contained.

---

## 3. Build & Verify

```bash
pnpm build          # Compile TypeScript → dist/
pnpm typecheck      # Type-check without emitting (must be zero errors)
pnpm test           # Run all tests
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
docker run -d --name docengine-pg -p 5432:5432 \
  -e POSTGRES_USER=docengine -e POSTGRES_PASSWORD=docengine -e POSTGRES_DB=docengine \
  postgres:16-alpine

docker run -d --name docengine-redis -p 6379:6379 redis:7-alpine
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
  createDocumentEngine,
  AnthropicAiProvider,
  S3StorageProvider,
  BullMQQueueProvider,
} from "@docgen/document-engine";

const engine = createDocumentEngine({
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
await engine.generate(documentId, tenantId);

// Graceful shutdown
await engine.shutdown();
```

For local development without AWS, use `LocalStorageProvider`:

```typescript
import { LocalStorageProvider } from "@docgen/document-engine";

const storage = new LocalStorageProvider("/tmp/document-engine-storage");
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

### Documents

#### Create a Document

```
POST /api/documents
Content-Type: application/json

{
  "docType": "budget_book",
  "title": "FY2026 Budget Book",
  "fiscalYear": 2026,
  "dataSource": "upload",        // "module" (query DataProvider) or "upload" (Excel file)
  "worksheetId": "ws-123",       // optional, for module data source
  "maxIterations": 3             // optional, 1–10, default 3
}
```

The `docType` field is required and must match a registered document type (e.g., `budget_book`, `pafr`).

Returns `201` with the created document record.

#### List Documents

```
GET /api/documents
```

Returns all documents for the authenticated tenant, ordered by creation date.

#### Get a Document

```
GET /api/documents/:id
```

Returns the full document record or `404`.

#### Delete a Document

```
DELETE /api/documents/:id
```

Returns `204` on success. Cascades to sections, reviews, jobs, and todos.

#### Upload Data File

```
POST /api/documents/:id/data-file
Content-Type: multipart/form-data

(attach Excel/CSV file as form field)
```

Uploads the file to storage and sets `dataSource` to `"upload"`. Max file size: 50 MB.

#### Upload Prior-Year Document

```
POST /api/documents/:id/prior-document
Content-Type: multipart/form-data

(attach PDF file as form field)
```

The engine analyzes this PDF to extract style guidance (tone, chart types, layout) for the new document.

#### Start Generation

```
POST /api/documents/:id/generate
```

Enqueues the generation job. Returns `202 Accepted`. Only works from `"draft"` or `"failed"` status.

The worker picks up the job and runs the full orchestration pipeline:
1. Seed Skills
2. Analyze Prior Document
3. Index Prior Document
4. Extract Prior Content
5. Merge Section List
6. Fetch Data
7. Detect Data Gaps
8. Generate Sections
9. Compose Sections
10. Render Charts (skipped when Composer active)
11. Review & Iterate
12. Render Output
13. Finalize

#### Regenerate

```
POST /api/documents/:id/regenerate
```

Re-runs generation after a user addresses todos. Works from `"completed"`, `"completed_with_todos"`, or `"failed"` status. Returns `202`.

#### Get Progress

```
GET /api/documents/:id/progress
```

Returns job-level progress for real-time UI updates:

```json
{
  "documentId": "...",
  "jobs": [
    { "jobType": "analyze_prior_document", "status": "completed", "progress": 100, "message": "Style analysis complete" },
    { "jobType": "generate_sections", "status": "running", "progress": 60, "message": "Generating revenue summary..." },
    { "jobType": "review", "status": "pending", "progress": 0 }
  ]
}
```

#### Get Preview

```
GET /api/documents/:id/preview
```

Returns the document metadata and all section content for web rendering.

#### Download PDF

```
GET /api/documents/:id/pdf
```

Redirects to a signed download URL for the generated PDF. Returns `404` if not yet generated.

#### Get Reviews

```
GET /api/documents/:id/reviews
```

Returns all review results across iterations, ordered chronologically.

---

### Todos

Todos are created automatically during generation (from data gaps and review findings). Users can chat with the advisor agent to resolve them.

#### List Todos for a Document

```
GET /api/documents/:documentId/todos
```

#### Get Todo with Messages

```
GET /api/documents/todos/:id
```

Returns the todo record and its full chat message history.

#### Send a Message (Chat with Advisor)

```
POST /api/documents/todos/:id/messages
Content-Type: application/json

{ "message": "Can you explain what revenue data is missing?" }
```

The advisor agent responds in context of the todo, the document, and prior chat history. Returns the agent's response.

#### Upload Attachment

```
POST /api/documents/todos/:id/files
Content-Type: multipart/form-data

(attach file)
```

Returns `{ s3Key: "..." }`.

#### Update Todo Status

```
PATCH /api/documents/todos/:id/status
Content-Type: application/json

{ "status": "resolved" }
```

Valid statuses: `open`, `in_progress`, `resolved`, `skipped`.

---

## 7. Implementing a Custom DataProvider

If you're integrating the engine into an existing application, implement the `DataProvider` interface to supply document data from your system:

```typescript
import type { DataProvider } from "@docgen/document-engine";

class MyDataProvider implements DataProvider {
  async getDocumentData(
    docTypeId: string,
    tenantId: string,
    worksheetId: string,
    fiscalYear: number
  ): Promise<unknown> {
    // Query your database, API, or data warehouse
    // Return data matching the doc type's dataSchema
    return { fiscalYear, ... };
  }
}
```

The returned data is validated at runtime against the document type's `dataSchema` (Zod). Each document type defines its own expected data shape — see `src/doc-types/budget-book/data-types.ts` for the budget book example.

Alternatively, use `dataSource: "upload"` to let users upload an Excel file, which the engine parses with Claude.

---

## 8. Document Lifecycle

```
draft → analyzing → generating → reviewing → revision → reviewing → ... → completed
                                                                          → completed_with_todos
                                                                          → failed
```

| Status | Meaning |
|--------|---------|
| `draft` | Created, awaiting file uploads and generation trigger |
| `analyzing` | Parsing prior-year document for style guidance |
| `generating` | AI agents are writing section content |
| `reviewing` | Reviewers are evaluating the document |
| `revision` | Creator is revising sections based on review feedback |
| `completed` | All reviews passed, PDF generated, no open todos |
| `completed_with_todos` | PDF generated but action items remain for the user |
| `failed` | An error occurred; can be retried with `/generate` |

The review-revise loop runs up to `maxIterations` times (default 3). It stops early if:
- All reviewers pass
- Scores plateau (no improvement between iterations)
- Custom `shouldContinueIterating` logic on the doc type returns false

---

## 9. Self-Improving Skill System

The engine learns from every generation cycle. After each review, it extracts "skills" — lessons learned — and injects them into future agent prompts.

- Global seed skills are created on first run (idempotent), defined per document type
- Skills extracted from reviews are scoped to the tenant
- Max **15 skills per prompt**, max **30 per agent+tenant combination**
- Priority hierarchy is configurable per document type
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

## 11. Eval System

The engine includes an automated evaluation framework for end-to-end testing of the generation pipeline against fixture data.

```bash
npx tsx evals/run.ts evals/fixtures/bristol-fy27  # Run Bristol FY27 evaluation
```

Reports are written to `evals/fixtures/<name>/output/report.md`. Each report includes pipeline execution details, review scores, document comparison, a letter grade (A-F), and actionable recommendations.

Fixture directories contain the input data (Excel file + prior-year PDF) needed to run the full pipeline without external dependencies.

---

## 12. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ECONNREFUSED` on startup | Ensure Postgres and Redis are running and `DATABASE_URL`/`REDIS_URL` are correct |
| `relation "documents" does not exist` | Run `pnpm db:push` to create the schema |
| Chart rendering fails | Puppeteer needs Chromium. In Docker this is handled automatically. Locally, run `npx puppeteer browsers install chrome` |
| `401 Unauthorized` on API calls | Include `x-tenant-id` header in all `/api/*` requests |
| Generation stuck in `"generating"` | Check the worker process is running (`pnpm worker`). Check Redis connectivity. |
| `ANTHROPIC_API_KEY` errors | Verify the key is set and has sufficient credits |
| File upload returns `413` | Max upload size is 50 MB (configured in Fastify multipart) |
