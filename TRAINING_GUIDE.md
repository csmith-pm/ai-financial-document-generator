# Agent Training Guide

How to use the Document Engine workbench to train AI agents for better document generation results.

---

## Overview

The Document Engine uses a **self-improving multi-agent system** where AI agents learn from every review cycle. Skills — contextual guidelines extracted from reviewer feedback — are stored in the database and injected into agent prompts on future documents. Over time, each tenant's documents improve without any code changes.

The **workbench** is a developer-facing toolset (CLI + web routes) that lets you inspect, debug, and tune this training loop. Use it to:

- Test data parsing and section generation in isolation
- Audit the skill landscape for any tenant
- Compare document iterations side-by-side
- Identify plateau patterns and tune agent parameters

---

## Prerequisites

1. **Running infrastructure** — PostgreSQL and Redis must be available:
   ```bash
   docker-compose up -d postgres redis
   ```

2. **Built engine** — TypeScript must be compiled:
   ```bash
   pnpm build
   ```

3. **Environment variables** — `DATABASE_URL`, `REDIS_URL`, and `ANTHROPIC_API_KEY` must be set (see `.env.example`).

4. **Seeded database** — Run at least one document generation so that `seedGlobalSkills` has executed, or trigger it manually via the pipeline.

---

## Workbench CLI

The CLI provides offline inspection without starting a server. Run commands with `pnpm workbench:cli`.

### List registered document types

```bash
pnpm workbench:cli doc-types
```

Shows all registered document types with their agents, reviewers, section types, and seed skill counts. Use this to verify that your document type is properly registered and configured.

### Validate a data file

```bash
pnpm workbench:cli validate budget_book --data ./sample-data.xlsx
```

Parses and validates an Excel/CSV file against the document type's `dataSchema` without making any AI calls. Returns:
- Parsed data structure
- Validation errors (missing required fields, type mismatches)
- Detected data gaps (fields that are optional but recommended)

This is the fastest way to verify that your input data is well-formed before running a full generation.

### List section types

```bash
pnpm workbench:cli sections budget_book
```

Shows all section types for a document type, including:
- Section ID and display name
- Whether it runs in parallel or sequentially
- Whether it's structural (cover page, TOC) vs. content-driven

---

## Workbench Web Routes

Start the workbench server for interactive exploration:

```bash
pnpm workbench
```

This starts a Fastify server with dev-only routes at `/workbench/*` (no authentication required).

### GET /workbench/doc-types

Lists all registered document types with full configuration: agents, reviewers, section types, seed skill count, and storage prefix. Useful for verifying runtime registration matches your expectations.

### POST /workbench/run-section

**The most important training tool.** Generates a single section in isolation — stateless, no database writes.

```json
POST /workbench/run-section
{
  "docType": "budget_book",
  "sectionType": "revenue_summary",
  "tenantId": "test-tenant",
  "data": { ... }
}
```

Returns:
- **Raw AI output** — the generated narrative, tables, and chart configs
- **System prompt** — the full prompt sent to the creator agent (including injected skills)
- **User prompt** — the section-specific generation prompt
- **Token usage** — input/output token counts

This lets you iterate on prompts and inspect exactly what the agent sees, without waiting for a full pipeline run.

### GET /workbench/skills/:docType/:tenantId

Audits the complete skill landscape for a document type and tenant. Returns all skills grouped by agent type, showing:
- Skill text, category, and trigger condition
- Confidence score (0.00-1.00)
- Scope: `global` (seed) vs. `customer` (learned from reviews)
- Source: which review or seed batch created it
- Status: `active` or `retired`

Use this to understand what the agents have learned and whether customer skills are overriding global seeds as expected.

### GET /workbench/iterations/:docId

Compares all iterations of a document side-by-side. Returns:
- All sections grouped by iteration number
- Review scores per reviewer per iteration
- Revision diffs between iterations

This is essential for understanding whether the review-and-iterate loop is making meaningful progress or hitting a plateau.

### POST /workbench/upload-test-data

Upload and parse a data file without creating a document:

```
POST /workbench/upload-test-data?docType=budget_book
Content-Type: multipart/form-data
```

Returns parsed data, validation errors, and detected gaps. Similar to the CLI validate command but accessible via HTTP.

---

## Training Workflow

Follow this process to train agents for a new document type or improve results for an existing one.

### Step 1: Validate your data

Start with the CLI or upload route to ensure your input data parses correctly and passes schema validation.

```bash
pnpm workbench:cli validate budget_book --data ./fy2026-budget.xlsx
```

Fix any validation errors or data gaps before proceeding. The quality of generated documents is directly tied to the completeness and accuracy of input data.

### Step 2: Test individual sections

Use `/workbench/run-section` to generate sections one at a time. Focus on:

- **Prompt quality** — Read the full system prompt in the response. Are the right skills being injected? Is the base prompt clear enough?
- **Output quality** — Does the narrative match the expected tone, length, and structure? Are tables well-formatted? Do chart configs make sense?
- **Token efficiency** — Are you hitting the `maxTokens` ceiling? If so, consider splitting the section or raising the limit.

Iterate by adjusting the agent's `baseSystemPrompt` or `seedSkills` in the document type definition, rebuilding, and re-running.

### Step 3: Run full document generation

Generate a complete document through the API or UI to exercise the full pipeline, including:
- All sections generated (parallel + sequential)
- Chart rendering
- Review-and-iterate loop (up to `maxIterations`)
- Skill extraction from reviews

### Step 4: Inspect extracted skills

After generation completes, check what the system learned:

```
GET /workbench/skills/budget_book/your-tenant-id
```

Look for:
- **New customer skills** — Were meaningful patterns extracted from the reviews?
- **Skill categories** — Are skills landing in the right categories?
- **Confidence scores** — Do high-confidence skills align with the most important learnings?
- **Arbitration results** — Did any customer skills correctly override weaker global seeds?

### Step 5: Compare iterations

Use the iterations endpoint to understand the review-and-iterate loop:

```
GET /workbench/iterations/<document-id>
```

Check:
- **Score progression** — Are scores improving across iterations? A healthy pattern is 70 -> 85 -> 100+.
- **Plateau detection** — If scores aren't improving, the loop should terminate early. Verify `shouldContinueIterating` is working.
- **Revision quality** — Read the revised sections. Are revisions addressing the specific feedback from reviewers?

### Step 6: Repeat across multiple documents

Skills compound over time. Generate 3-5 documents for the same tenant to observe:
- Skill accumulation (more customer skills after each generation)
- Score improvement (first documents score lower, later ones start higher)
- Fewer iterations needed (agents learn what reviewers want)

---

## Understanding the Skill System

### Skill Types

| Type | Scope | Source | Persistence |
|------|-------|--------|-------------|
| **Seed skills** | Global | `DocumentTypeDefinition.seedSkills` | Inserted once, idempotent |
| **Learned skills** | Customer (tenant) | Extracted from review feedback by AI | Accumulate over generations |

### How Skills Enter the System

1. **Seeding** — On first generation, `seedGlobalSkills` inserts the document type's seed skills into the `agent_skills` table. This is idempotent; running it again is a no-op.

2. **Extraction** — After each review in the iterate loop, `extractSkillsFromReview` (defined per doc type) calls the AI to synthesize 3-5 learnings from low-scoring categories and recommendations. Each learning becomes a skill with:
   - `targetAgent` — which agent should use this skill
   - `skill` — the instruction text
   - `category` — semantic grouping (e.g., `gfoa_criteria`, `chart_design`, `accessibility`)
   - `trigger` — when to apply (e.g., "generating revenue_summary section")
   - `confidence` — 0.00-1.00

3. **Arbitration** — When a new skill is inserted, `negotiateSkill` resolves conflicts:
   - Customer skills override global seeds in the same category
   - Higher confidence wins among same-scope skills
   - Duplicates are detected and skipped

4. **Pruning** — After extraction, `pruneSkills` enforces a cap of 30 active skills per agent+tenant. Lowest-confidence skills are retired first, then oldest.

### How Skills Are Used

`buildAgentPrompt` loads the top 15 skills (by confidence) for the target agent and tenant. Customer skills override global seeds in the same category. Skills are formatted as a "Learned Guidelines" section appended to the base system prompt:

```
## Learned Guidelines

The following guidelines have been learned from prior reviews. Follow them when applicable:

1. [gfoa_criteria] Include multi-year trend analysis (3+ years) for all revenue sections
2. [chart_design] Use bar charts for departmental comparisons; avoid pie charts for accessibility
3. [accessibility] Add descriptive alt text to all charts (describe trends, not just values)
```

### Skill Lifecycle Example

**Scenario:** Revenue section charts scored poorly on first generation.

1. **Iteration 1** — BB_Reviewer scores revenue at 16/20: "Revenue chart lacks multi-year trend analysis."
2. **Extraction** — AI synthesizes: `{ targetAgent: "bb_creator", skill: "Include 3+ years of historical data with % change for revenue sections", category: "revenue_formatting", confidence: 0.85 }`
3. **Arbitration** — No existing customer skill for `revenue_formatting` -> inserted directly.
4. **Iteration 2** — Creator prompt now includes the new skill. Revenue section regenerated with 5-year trend.
5. **Re-score** — BB_Reviewer scores revenue at 20/20.
6. **Next document** — Skill persists. Future revenue sections start with the multi-year trend pattern.

---

## Tuning Recommendations

### Adjusting seed skills

Seed skills are defined in the document type's `seedSkills` array (e.g., `src/doc-types/budget-book/seeds.ts`). These form the baseline knowledge for all agents.

- **Add seeds** when you identify patterns that every document should follow from the start
- **Remove seeds** that are consistently overridden by learned skills (they're adding noise)
- **Raise confidence** on critical compliance seeds to ensure they aren't pruned
- After changing seeds, delete existing global skills for the doc type and re-run seeding

### Monitoring skill drift

Periodically check `/workbench/skills/:docType/:tenantId` for:
- **Category imbalance** — If one category dominates (e.g., 20 of 30 skills are `chart_design`), the extraction prompt may need tuning
- **Low-confidence accumulation** — Many skills at 0.50-0.60 suggests extraction isn't confident in its learnings
- **Stale skills** — Skills from early generations that no longer align with current standards

### Identifying plateau patterns

Use `/workbench/iterations/:docId` to spot plateaus:
- **Score plateau** — If scores stay flat across iterations (e.g., 85 -> 85 -> 85), the revision prompts may not be addressing the right issues. Check `buildRevisionPrompt` in the doc type definition.
- **Oscillation** — If scores bounce (85 -> 90 -> 83), revisions may be fixing one issue while introducing another. Consider narrowing revision scope.
- **Diminishing returns** — If the jump from iteration 1 to 2 is large but 2 to 3 is tiny, 2 iterations may be sufficient. Adjust `maxIterations`.

### Temperature tuning

Each agent has a `temperature` setting that controls output variability:

| Agent Role | Recommended Range | Rationale |
|------------|------------------|-----------|
| Creator | 0.3-0.5 | Balance between creativity and consistency |
| Reviewer | 0.1-0.2 | Precise, deterministic scoring |
| Advisor | 0.4-0.6 | Conversational but focused |

Lower temperatures produce more consistent output but less variety. If all generated sections feel templated, raise the creator temperature slightly.

### When to add reviewers vs. modify prompts

- **Add a new reviewer** when you have a distinct compliance standard or quality dimension that isn't covered (e.g., adding a plain-language reviewer for citizen-facing documents)
- **Modify existing prompts** when the reviewer is covering the right dimension but scoring incorrectly or providing unhelpful feedback
- **Add seed skills** when the creator agent consistently misses something that the reviewer catches — skills bridge the gap faster than prompt changes
