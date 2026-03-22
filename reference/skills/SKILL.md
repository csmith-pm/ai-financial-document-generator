---
name: budget-book
description: |
  This skill should be used when the user wants to create, generate, or produce a municipal budget book document. Trigger phrases include "budget book", "generate budget document", "create budget book", "annual budget report", "GFOA budget", or "budget publication". This skill orchestrates multi-agent budget book generation with GFOA award criteria compliance and ADA/WCAG 2.1 AA accessibility review.
version: 1.0.0
---

# Budget Book Generation Skill

## Overview

Generate comprehensive municipal budget books (50-200+ pages) that meet GFOA Distinguished Budget Presentation Award criteria and WCAG 2.1 AA accessibility standards.

## Workflow

1. **Analyze prior-year PDF** — Extract style, tone, format, chart types, layout, and branding from the user's uploaded prior-year budget book
2. **Fetch budget data** — Pull financial data from the selected Operating Budget version (proposed/adopted)
3. **Generate sections** — For each section (cover, TOC, executive summary, community profile, revenue, expenditure, personnel, capital, multi-year outlook, appendix), generate narrative content, table data, and chart configurations
4. **Render charts** — Convert chart configurations to PNG images using Recharts via headless browser
5. **GFOA review** — BB_Reviewer agent scores the book against 2026 GFOA criteria (9 content categories + 5 material type categories, 100+ points to pass)
6. **ADA review** — ADA_Reviewer agent checks PDF and web output against WCAG 2.1 AA
7. **Iterate** — BB_Creator revises based on reviewer feedback (up to 3 iterations)
8. **Finalize** — Render final PDF, generate web preview data
9. **Update learnings** — Append successful patterns and resolved issues to skill reference files

## Agents

- **BB_Creator** (agents/bb-creator.md) — Generates and revises budget book content
- **BB_Reviewer** (agents/bb-reviewer.md) — Scores against GFOA criteria
- **ADA_Reviewer** (agents/ada-reviewer.md) — Checks WCAG 2.1 AA compliance

## Reference Files

- `references/gfoa-criteria-2026.md` — GFOA Distinguished Budget Presentation Award criteria and scoring
- `references/ada-wcag-checklist.md` — WCAG 2.1 AA compliance checklist for budget documents
- `references/style-patterns.md` — Accumulated learnings about budget book styles (grows over time)
- `references/common-issues.md` — Accumulated learnings about common failures and fixes (grows over time)

## Key Principles

- Match the prior-year PDF's style, tone, and format as closely as possible
- Use actual financial data from the selected OB version — never fabricate numbers
- Every chart must have alt text describing the data trend
- Tables must have proper header associations for screen readers
- Color contrast must meet WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text)
- Narratives should be professional, clear, and suitable for elected officials and the public
