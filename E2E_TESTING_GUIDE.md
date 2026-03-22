# End-to-End Testing Guide

How to run and write E2E tests for the Document Engine UI against the live API.

---

## Overview

E2E tests exercise the full stack: the **Next.js UI** (port 3000) communicating with the **Fastify API** (port 4000), backed by **PostgreSQL** and **Redis**. Tests use [Playwright](https://playwright.dev/) to drive a real browser through the document creation, generation, monitoring, and management workflows.

### Test Suites

| File | What it covers |
|------|---------------|
| `full-workflow.spec.ts` | Complete flow: create document, upload data, generate, monitor progress, download |
| `reports-crud.spec.ts` | List reports, create new report, navigate to detail, delete |
| `todo-workflow.spec.ts` | View todos, chat with advisor, upload attachments, resolve todos |
| `validation.spec.ts` | Form validation: required fields, invalid inputs, error messages |

---

## Prerequisites

- **Node.js 20+** and **pnpm**
- **Docker** (for PostgreSQL and Redis)
- **Playwright browsers** installed (`npx playwright install`)
- **Anthropic API key** (required for full generation tests; set `ANTHROPIC_API_KEY` in environment)

---

## Environment Setup

### 1. Start infrastructure

```bash
cd /path/to/document-engine
docker-compose up -d postgres redis
```

This starts PostgreSQL 16 (port 5432) and Redis 7 (port 6379).

### 2. Build the engine

```bash
cd /path/to/document-engine
pnpm install
pnpm build
```

### 3. Install UI dependencies

```bash
cd /path/to/document-engine-ui
pnpm install
npx playwright install
```

### 4. Verify environment variables

The API server needs:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `ANTHROPIC_API_KEY` — For AI-powered generation tests

---

## Running Tests

### Run all E2E tests (headless)

```bash
cd /path/to/document-engine-ui
pnpm test:e2e
```

Playwright will automatically start both servers:
- **API server** on port 4000 (from `document-engine`)
- **UI dev server** on port 3000 (from `document-engine-ui`)

### Run with Playwright UI (interactive debugging)

```bash
pnpm test:e2e:ui
```

Opens the Playwright Test Runner UI where you can:
- Run individual tests with a click
- Watch tests execute in real-time
- Step through test actions
- Inspect DOM snapshots at each step
- View network requests and console logs

### Run a specific test

```bash
pnpm test:e2e -- --grep "create report"
```

### Run a specific test file

```bash
pnpm test:e2e -- tests/e2e/reports-crud.spec.ts
```

---

## Playwright Configuration

The config lives at `tests/e2e/playwright.config.ts`. Key settings:

| Setting | Value | Notes |
|---------|-------|-------|
| Base URL | `http://localhost:3000` | UI dev server |
| Timeout | 120 seconds | Generation can take time with real AI |
| Workers | 1 | Sequential execution (shared DB state) |
| Retries | 1 | One automatic retry on failure |
| Test tenant | `e2e-test` | Isolated via `x-tenant-id` header |

### Web Servers

Playwright automatically manages two servers:

1. **API** (port 4000) — Starts from the engine's compiled output
2. **UI** (port 3000) — Starts the Next.js dev server

Both servers are started before tests and shut down after. If either server fails to start, tests will not run.

---

## Test Suites in Detail

### full-workflow.spec.ts

Tests the complete document lifecycle:

1. Navigate to `/reports/new`
2. Select document type (Budget Book or PAFR)
3. Enter title and fiscal year
4. Upload an Excel data file
5. Optionally upload a prior-year PDF
6. Start generation
7. Monitor progress via polling (job status updates)
8. Verify document reaches `completed` or `completed_with_todos` status
9. Check that sections, reviews, and PDF are available

This is the most comprehensive test and exercises nearly every API endpoint.

### reports-crud.spec.ts

Tests basic document management:

- List all reports for the test tenant
- Create a new report via the wizard
- Navigate from list to detail view
- Delete a report with confirmation dialog
- Verify empty state when no reports exist

### todo-workflow.spec.ts

Tests the interactive todo system:

- View todos generated from a completed document
- Filter by status (open, in_progress, resolved, skipped)
- Open a todo and chat with the advisor agent
- Upload a file attachment to a todo
- Update todo status

### validation.spec.ts

Tests form validation edge cases:

- Required field enforcement (title, fiscal year, document type)
- Fiscal year range validation (2000-2100)
- File type restrictions on uploads
- Error message display and clearing

---

## Writing New E2E Tests

### API Helpers

The `tests/e2e/helpers/api-helpers.ts` file provides utility functions for test setup and teardown:

```typescript
// Create a document via API (bypasses UI for faster setup)
const doc = await createTestDocument({
  docType: "budget_book",
  title: "E2E Test Budget",
  fiscalYear: 2026,
});

// Clean up after tests
await deleteTestDocument(doc.id);

// Clean up ALL documents for the test tenant
await cleanupTestDocuments();

// Wait for a document to reach a target status (with polling)
await waitForStatus(doc.id, "completed", { timeoutMs: 120_000 });
```

### Factory Functions

The `tests/fixtures/factories.ts` file provides factory functions for creating test data:

- `makeDocument()` — Document with sensible defaults
- `makeDocumentJob()` — Pipeline job entry
- `makeDocumentSection()` — Section with narrative, tables, charts
- `makeDocumentReview()` — Review result with scores
- `makeDocumentTodo()` — Todo item
- `makeTodoMessage()` — Chat message
- `makeChartConfig()` — Chart configuration
- `makeTableRows()` — Table data
- `makeWcagReport()` — WCAG accessibility report

All factories accept partial overrides:

```typescript
const doc = makeDocument({ title: "Custom Title", status: "generating" });
```

### Test Structure Pattern

```typescript
import { test, expect } from "@playwright/test";
import { createTestDocument, cleanupTestDocuments } from "./helpers/api-helpers";

test.describe("My Feature", () => {
  test.afterEach(async () => {
    await cleanupTestDocuments();
  });

  test("does something", async ({ page }) => {
    // Setup: create test data via API
    const doc = await createTestDocument({ ... });

    // Act: navigate and interact
    await page.goto(`/reports/${doc.id}`);
    await page.getByRole("button", { name: "Generate" }).click();

    // Assert: verify expected outcome
    await expect(page.getByText("Generation started")).toBeVisible();
  });
});
```

### Handling Async Generation

Document generation is asynchronous. The UI polls `GET /api/documents/:id/progress` every 3 seconds. In tests:

- Use `waitForStatus()` helper for API-level waits
- Use Playwright's `expect(...).toBeVisible({ timeout: 60_000 })` for UI-level waits
- Set generous timeouts — real AI generation can take 30-90 seconds per section

### Tenant Isolation

All E2E tests run under the `e2e-test` tenant (set via `x-tenant-id` header in the Playwright config). This isolates test data from development data. Always clean up after tests with `cleanupTestDocuments()`.

---

## API Endpoints Used by the UI

Every API call the UI makes, mapped to the user action that triggers it:

| User Action | Method | Endpoint |
|-------------|--------|----------|
| Open reports page | GET | `/api/documents` |
| View report detail | GET | `/api/documents/:id` |
| Create new report | POST | `/api/documents` |
| Upload data file | POST | `/api/documents/:id/data-file` |
| Upload prior document | POST | `/api/documents/:id/prior-document` |
| Start generation | POST | `/api/documents/:id/generate` |
| Continue generation | POST | `/api/documents/:id/regenerate` |
| Monitor progress | GET | `/api/documents/:id/progress` |
| View section preview | GET | `/api/documents/:id/preview` |
| View reviews | GET | `/api/documents/:id/reviews` |
| Download PDF | GET | `/api/documents/:id/pdf` |
| View todos | GET | `/api/documents/:documentId/todos` |
| Open todo detail | GET | `/api/documents/todos/:id` |
| Send chat message | POST | `/api/documents/todos/:id/messages` |
| Upload todo file | POST | `/api/documents/todos/:id/files` |
| Update todo status | PATCH | `/api/documents/todos/:id/status` |
| Delete report | DELETE | `/api/documents/:id` |

---

## Troubleshooting

### Tests timeout during generation

**Symptom:** `full-workflow.spec.ts` fails with timeout after 120 seconds.

**Causes:**
- Anthropic API is slow or rate-limited. Check your API key tier.
- Worker isn't processing jobs. Verify Redis is running and the worker started.
- Database connection failed. Check `DATABASE_URL`.

**Fix:** Increase timeout in `playwright.config.ts` or run generation-dependent tests separately with `--timeout 300000`.

### Port conflicts

**Symptom:** "Port 4000 already in use" or "Port 3000 already in use."

**Fix:** Kill existing processes:
```bash
lsof -ti:4000 | xargs kill
lsof -ti:3000 | xargs kill
```

### Stale test data

**Symptom:** Tests fail because documents from a previous run still exist.

**Fix:** Run cleanup manually:
```bash
curl -X DELETE http://localhost:4000/api/documents \
  -H "x-tenant-id: e2e-test"
```

Or ensure `cleanupTestDocuments()` is called in `afterEach`.

### Playwright browsers not installed

**Symptom:** "Browser not found" error.

**Fix:**
```bash
npx playwright install
```

### API server won't start

**Symptom:** Playwright reports "Server failed to start" for port 4000.

**Check:**
1. Engine is built: `pnpm build` in document-engine
2. Database is running: `docker-compose ps`
3. Migrations applied: `pnpm db:push`
4. Environment variables set
