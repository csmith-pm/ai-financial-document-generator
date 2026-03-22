/**
 * Budget Book Orchestrator v2.
 *
 * Coordinates the multi-agent budget book generation workflow:
 * 1. Seed global skills (if first run)
 * 2. Analyze prior-year PDF for style
 * 3. Fetch budget data + detect data gaps → create todos
 * 4. Generate sections in parallel (using agent definitions + skills)
 * 5. Render charts
 * 6. Review via BB_Reviewer + ADA_Reviewer in parallel
 * 7. Extract skills from reviews
 * 8. Create quality todos from first GFOA review
 * 9. Iterate with plateau detection (stop if score doesn't improve)
 * 10. Render final PDF
 * 11. Set final status based on open todos
 */

import { eq, and } from "drizzle-orm";
import {
  documents,
  documentSections,
  documentReviews,
  documentJobs,
  documentTodos,
  documentStatusEnum,
} from "../db/schema.js";
import type { BudgetBookData } from "./providers.js";
import type { StyleAnalysis } from "./types.js";
import { renderChartsForSection } from "./chartRenderer.js";
import { buildAgentPrompt } from "./agents/index.js";
import { seedGlobalSkills } from "./skills/seeds.js";
import {
  extractSkillsFromGfoaReview,
  extractSkillsFromAdaReview,
} from "./skills/extractor.js";
import {
  createTodosFromDataGaps,
  createTodosFromGfoaReview,
} from "./todos/creator.js";
import type { ChartConfig } from "./chartTypes.js";
import type { EngineContext } from "./context.js";
import type { DrizzleInstance } from "../db/connection.js";
import { defaultRegistry } from "./doc-type-registry.js";
import type { DocumentTypeDefinition } from "./doc-type.js";

// Types re-imported from budget-book doc type for internal use
import type { GfoaReviewResult, AdaReviewResult } from "../doc-types/budget-book/review-types.js";

// Section types come from the doc type at runtime
interface SectionOutput {
  sectionType: string;
  title: string;
  narrativeContent: string;
  tableData: Record<string, unknown>[];
  chartConfigs: ChartConfig[];
}

// ---- Job Progress Helpers ----

type JobType = "analyze_prior_pdf" | "generate_sections" | "render_charts" | "gfoa_review" | "ada_review" | "revise_sections" | "render_pdf" | "finalize";

async function updateJobStatus(
  db: DrizzleInstance,
  budgetBookId: string,
  jobType: JobType,
  status: string,
  progress: number,
  message: string,
  error?: string
): Promise<void> {
  const now = new Date();
  const startedAt = status === "running" && progress === 0 ? now : null;
  const completedAt =
    status === "completed" || status === "failed" ? now : null;

  const setFields: Record<string, unknown> = {
    status,
    progress,
    message,
    error: error ?? null,
  };
  if (startedAt) setFields.startedAt = startedAt;
  if (completedAt) setFields.completedAt = completedAt;

  await db
    .update(documentJobs)
    .set(setFields)
    .where(
      and(
        eq(documentJobs.documentId, budgetBookId),
        eq(documentJobs.jobType, jobType)
      )
    );
}

type BookStatus = (typeof documentStatusEnum.enumValues)[number];

async function updateBookStatus(
  db: DrizzleInstance,
  budgetBookId: string,
  status: BookStatus
): Promise<void> {
  await db
    .update(documents)
    .set({ status, updatedAt: new Date() })
    .where(eq(documents.id, budgetBookId));
}

// ---- Section Generation (using doc type + agent definitions + skills) ----

async function generateSection(
  ctx: EngineContext,
  docType: DocumentTypeDefinition,
  sectionType: string,
  data: BudgetBookData,
  styleAnalysis: StyleAnalysis | null
): Promise<SectionOutput> {
  const creatorAgent = docType.getAgent("bb_creator");
  const systemPrompt = await buildAgentPrompt(ctx.db, "bb_creator", ctx.tenantId);
  const userPrompt = docType.getSectionPrompt(sectionType, data, styleAnalysis);

  const result = await ctx.ai.callJson<SectionOutput>(
    systemPrompt,
    userPrompt,
    { maxTokens: creatorAgent.maxTokens, temperature: creatorAgent.temperature }
  );

  await ctx.ai.logUsage?.(
    ctx.tenantId,
    `bb_creator_${sectionType}`,
    result.inputTokens,
    result.outputTokens,
    result.model
  );

  return result.data;
}

// ---- Review Functions (using agent definitions + skills) ----

async function runGfoaReview(
  ctx: EngineContext,
  docType: DocumentTypeDefinition,
  sections: SectionOutput[]
): Promise<GfoaReviewResult> {
  const systemPrompt = await buildAgentPrompt(ctx.db, "bb_reviewer", ctx.tenantId);
  const definition = docType.getAgent("bb_reviewer");

  const sectionSummary = sections.map((s) => ({
    type: s.sectionType,
    title: s.title,
    narrativeLength: s.narrativeContent.length,
    tableRowCount: s.tableData.length,
    chartCount: s.chartConfigs.length,
    narrativePreview: s.narrativeContent.substring(0, 500),
  }));

  const userPrompt = `Review this budget book with ${sections.length} sections:\n${JSON.stringify(sectionSummary, null, 2)}\n\nFull section content:\n${JSON.stringify(sections, null, 2)}\n\nOutput format:\n{\n  "scores": [{"category": "...", "maxPoints": N, "awardedPoints": N, "feedback": "..."}],\n  "totalScore": N,\n  "passed": true/false,\n  "recommendations": [{"section": "...", "priority": "high|medium|low", "issue": "...", "suggestion": "..."}]\n}`;

  const result = await ctx.ai.callJson<GfoaReviewResult>(
    systemPrompt,
    userPrompt,
    { maxTokens: definition.maxTokens, temperature: definition.temperature }
  );

  await ctx.ai.logUsage?.(
    ctx.tenantId,
    "bb_reviewer",
    result.inputTokens,
    result.outputTokens,
    result.model
  );

  return result.data;
}

async function runAdaReview(
  ctx: EngineContext,
  docType: DocumentTypeDefinition,
  sections: SectionOutput[]
): Promise<AdaReviewResult> {
  const systemPrompt = await buildAgentPrompt(ctx.db, "ada_reviewer", ctx.tenantId);
  const definition = docType.getAgent("ada_reviewer");

  const userPrompt = `Check accessibility for this budget book:\n${JSON.stringify(sections, null, 2)}\n\nOutput format:\n{\n  "pdfIssues": [{"rule": "WCAG X.X.X Name", "severity": "critical|major|minor", "location": "...", "description": "...", "fix": "..."}],\n  "webIssues": [{"rule": "WCAG X.X.X Name", "severity": "critical|major|minor", "location": "...", "description": "...", "fix": "..."}],\n  "passed": true/false\n}`;

  const result = await ctx.ai.callJson<AdaReviewResult>(
    systemPrompt,
    userPrompt,
    { maxTokens: definition.maxTokens, temperature: definition.temperature }
  );

  await ctx.ai.logUsage?.(
    ctx.tenantId,
    "ada_reviewer",
    result.inputTokens,
    result.outputTokens,
    result.model
  );

  return result.data;
}

// ---- Revision ----

async function reviseSection(
  ctx: EngineContext,
  docType: DocumentTypeDefinition,
  section: SectionOutput,
  gfoaFeedback: string[],
  adaFeedback: string[],
  data: BudgetBookData,
  _styleAnalysis: StyleAnalysis | null
): Promise<SectionOutput> {
  const systemPrompt = await buildAgentPrompt(ctx.db, "bb_creator", ctx.tenantId);
  const definition = docType.getAgent("bb_creator");

  // Revision gets a more targeted prompt than initial generation
  const revisionSystemPrompt = `${systemPrompt}\n\nYou are revising an existing section based on reviewer feedback. Make targeted improvements to address the specific issues raised. Maintain the same overall structure and data. Respond with valid JSON in the same format as the original section.`;

  const userPrompt = `Original section:\n${JSON.stringify(section, null, 2)}\n\nGFOA feedback for this section:\n${gfoaFeedback.join("\n")}\n\nADA feedback for this section:\n${adaFeedback.join("\n")}\n\nBudget data context:\n${JSON.stringify(docType.getSectionData(section.sectionType, data), null, 2)}`;

  const result = await ctx.ai.callJson<SectionOutput>(
    revisionSystemPrompt,
    userPrompt,
    { maxTokens: definition.maxTokens, temperature: 0.3 }
  );

  await ctx.ai.logUsage?.(
    ctx.tenantId,
    `bb_creator_revise_${section.sectionType}`,
    result.inputTokens,
    result.outputTokens,
    result.model
  );

  return result.data;
}

// ---- Chart Rendering Helper ----

async function renderAndUploadCharts(
  ctx: EngineContext,
  section: SectionOutput,
  budgetBookId: string,
  suffix: string = ""
): Promise<string[]> {
  const s3Keys: string[] = [];
  if (section.chartConfigs.length === 0) return s3Keys;

  try {
    const chartBuffers = await renderChartsForSection(section.chartConfigs);
    for (let j = 0; j < chartBuffers.length; j++) {
      const buf = chartBuffers[j];
      if (!buf) continue;
      const key = `${ctx.tenantId}/budget-books/${budgetBookId}/charts/${section.sectionType}-${j}${suffix}.png`;
      await ctx.storage.upload(key, buf, "image/png");
      s3Keys.push(key);
    }
  } catch (chartErr) {
    console.warn(
      `[budget-book] Chart rendering failed for ${section.sectionType}, continuing:`,
      chartErr
    );
  }
  return s3Keys;
}

// ---- Main Orchestration ----

export async function orchestrateBudgetBookGeneration(
  ctx: EngineContext,
  budgetBookId: string
): Promise<void> {
  // Load budget book record
  const [book] = await ctx.db
    .select()
    .from(documents)
    .where(eq(documents.id, budgetBookId))
    .limit(1);

  if (!book) {
    throw new Error(`Budget book ${budgetBookId} not found`);
  }

  // Look up the document type from the registry
  const docType = defaultRegistry.get(book.docType ?? "budget_book");
  const fiscalYear = book.fiscalYear ?? new Date().getFullYear();

  try {
    // ---- Step 0: Seed global skills (idempotent) ----
    await seedGlobalSkills(ctx.db, docType.seedSkills);

    // ---- Step 1: Analyze prior-year PDF ----
    await updateBookStatus(ctx.db, budgetBookId, "analyzing");
    await updateJobStatus(
      ctx.db,
      budgetBookId,
      "analyze_prior_pdf",
      "running",
      0,
      "Analyzing prior-year budget book..."
    );

    let styleAnalysis: StyleAnalysis | null = null;
    if (book.priorYearPdfS3Key && docType.analyzePriorDocument) {
      styleAnalysis = await docType.analyzePriorDocument(
        ctx.ai,
        ctx.storage,
        ctx.tenantId,
        book.priorYearPdfS3Key
      );
      await ctx.db
        .update(documents)
        .set({
          styleAnalysis:
            styleAnalysis as unknown as Record<string, unknown>,
        })
        .where(eq(documents.id, budgetBookId));
    }

    await updateJobStatus(
      ctx.db,
      budgetBookId,
      "analyze_prior_pdf",
      "completed",
      100,
      "Style analysis complete"
    );

    // ---- Step 2: Fetch budget data ----
    await updateBookStatus(ctx.db, budgetBookId, "generating");
    await updateJobStatus(
      ctx.db,
      budgetBookId,
      "generate_sections",
      "running",
      0,
      "Fetching budget data..."
    );

    let budgetData: BudgetBookData;

    if (book.dataSource === "upload" && book.uploadedDataS3Key && docType.parseUpload) {
      // Upload path: parse the Excel file with AI
      const excelBuffer = await ctx.storage.getObject(book.uploadedDataS3Key);
      budgetData = await docType.parseUpload(ctx.ai, excelBuffer, { fiscalYear }) as BudgetBookData;
    } else if (book.worksheetId) {
      // Module path: query the database
      budgetData = await ctx.data.getBudgetData(
        ctx.tenantId,
        book.worksheetId ?? "",
        fiscalYear
      );
    } else {
      throw new Error("Budget book has no data source: no worksheet and no uploaded file");
    }

    // ---- Step 2.5: Detect data gaps → create todos (but continue) ----
    const dataGaps = docType.detectDataGaps(budgetData);
    if (dataGaps.length > 0) {
      await createTodosFromDataGaps(ctx.db, budgetBookId, ctx.tenantId, dataGaps);
      console.log(
        `[budget-book] Created ${dataGaps.length} data gap todo(s) — continuing generation with available data`
      );
    }

    // ---- Step 3: Generate sections (parallel where independent) ----
    const sections: SectionOutput[] = [];
    const allSectionSpecs = docType.sectionTypes;
    const contentSpecs = allSectionSpecs.filter((s) => !s.structural);
    const structuralSpecs = allSectionSpecs.filter((s) => s.structural);

    // Parallel batch: sections marked as parallel
    const parallelSpecs = contentSpecs.filter((s) => s.parallel);
    const sequentialSpecs = contentSpecs.filter((s) => !s.parallel);

    // Run parallel sections concurrently
    await updateJobStatus(
      ctx.db,
      budgetBookId,
      "generate_sections",
      "running",
      10,
      "Generating data sections in parallel..."
    );

    const parallelResults = await Promise.all(
      parallelSpecs.map((spec) =>
        generateSection(ctx, docType, spec.id, budgetData, styleAnalysis)
      )
    );
    sections.push(...parallelResults);

    // Run sequential sections (executive summary depends on data sections for context)
    for (let i = 0; i < sequentialSpecs.length; i++) {
      const spec = sequentialSpecs[i]!;
      const progress = Math.round(
        50 + ((i + 1) / sequentialSpecs.length) * 30
      );
      await updateJobStatus(
        ctx.db,
        budgetBookId,
        "generate_sections",
        "running",
        progress,
        `Generating ${spec.id.replace(/_/g, " ")}...`
      );
      const section = await generateSection(
        ctx,
        docType,
        spec.id,
        budgetData,
        styleAnalysis
      );
      sections.push(section);
    }

    // Generate structural sections (cover, toc)
    const structuralResults = await Promise.all(
      structuralSpecs.map((spec) =>
        generateSection(ctx, docType, spec.id, budgetData, styleAnalysis)
      )
    );
    sections.push(...structuralResults);

    await updateJobStatus(
      ctx.db,
      budgetBookId,
      "generate_sections",
      "completed",
      100,
      "All sections generated"
    );

    // ---- Step 4: Render charts ----
    await updateJobStatus(
      ctx.db,
      budgetBookId,
      "render_charts",
      "running",
      0,
      "Rendering charts..."
    );

    for (const section of sections) {
      const s3Keys = await renderAndUploadCharts(
        ctx,
        section,
        budgetBookId
      );

      await ctx.db.insert(documentSections).values({
        documentId: budgetBookId,
        tenantId: ctx.tenantId,
        sectionType: section.sectionType,
        sectionOrder: allSectionSpecs.findIndex((s) => s.id === section.sectionType),
        title: section.title,
        narrativeContent: section.narrativeContent,
        tableData: section.tableData,
        chartConfigs:
          section.chartConfigs as unknown as Record<string, unknown>[],
        chartImageS3Keys: s3Keys,
      });
    }

    await updateJobStatus(
      ctx.db,
      budgetBookId,
      "render_charts",
      "completed",
      100,
      "Charts rendered"
    );

    // ---- Step 5-7: Review, extract skills, and iterate ----
    await updateBookStatus(ctx.db, budgetBookId, "reviewing");

    let currentSections = sections;
    let iteration = 0;
    const maxIterations = book.maxIterations ?? 3;
    let previousGfoaScore = 0;

    while (iteration < maxIterations) {
      iteration++;
      await ctx.db
        .update(documents)
        .set({ currentIteration: iteration })
        .where(eq(documents.id, budgetBookId));

      // Run GFOA + ADA reviews in parallel
      await updateJobStatus(
        ctx.db,
        budgetBookId,
        "gfoa_review",
        "running",
        0,
        `GFOA review — iteration ${iteration}...`
      );
      await updateJobStatus(
        ctx.db,
        budgetBookId,
        "ada_review",
        "running",
        0,
        `ADA review — iteration ${iteration}...`
      );

      const [gfoaResult, adaResult] = await Promise.all([
        runGfoaReview(ctx, docType, currentSections),
        runAdaReview(ctx, docType, currentSections),
      ]);

      // Save GFOA review (capture the ID for skill extraction + todo linking)
      const [gfoaReviewRow] = await ctx.db
        .insert(documentReviews)
        .values({
          documentId: budgetBookId,
          tenantId: ctx.tenantId,
          reviewerType: "gfoa",
          iteration,
          overallScore: String(gfoaResult.totalScore),
          passed: gfoaResult.passed,
          report: gfoaResult as unknown as Record<string, unknown>,
          recommendations:
            gfoaResult.recommendations as unknown as Record<string, unknown>[],
        })
        .returning({ id: documentReviews.id });

      await updateJobStatus(
        ctx.db,
        budgetBookId,
        "gfoa_review",
        "completed",
        100,
        `GFOA score: ${gfoaResult.totalScore}/180 — ${gfoaResult.passed ? "PASSED" : "needs improvement"}`
      );

      // Save ADA review
      const [adaReviewRow] = await ctx.db
        .insert(documentReviews)
        .values({
          documentId: budgetBookId,
          tenantId: ctx.tenantId,
          reviewerType: "ada",
          iteration,
          overallScore: null,
          passed: adaResult.passed,
          report: adaResult as unknown as Record<string, unknown>,
          recommendations: [
            ...adaResult.pdfIssues,
            ...adaResult.webIssues,
          ] as unknown as Record<string, unknown>[],
        })
        .returning({ id: documentReviews.id });

      await updateJobStatus(
        ctx.db,
        budgetBookId,
        "ada_review",
        "completed",
        100,
        `ADA: ${adaResult.passed ? "PASSED" : `${adaResult.pdfIssues.length + adaResult.webIssues.length} issues found`}`
      );

      // ---- Extract skills from reviews (self-improving loop) ----
      try {
        await extractSkillsFromGfoaReview(
          ctx.db,
          ctx.ai,
          ctx.tenantId,
          gfoaResult,
          gfoaReviewRow.id
        );
        await extractSkillsFromAdaReview(
          ctx.db,
          ctx.ai,
          ctx.tenantId,
          adaResult,
          adaReviewRow.id
        );
      } catch (skillErr) {
        console.warn(
          "[budget-book] Skill extraction failed (non-fatal):",
          skillErr
        );
      }

      // ---- Create quality todos from first GFOA review ----
      if (iteration === 1 && gfoaResult.recommendations.length > 0) {
        await createTodosFromGfoaReview(
          ctx.db,
          budgetBookId,
          ctx.tenantId,
          gfoaResult,
          gfoaReviewRow.id
        );
      }

      // Check if both pass
      if (gfoaResult.passed && adaResult.passed) {
        break;
      }

      // Don't revise on the last iteration
      if (iteration >= maxIterations) {
        break;
      }

      // ---- Plateau detection: stop if score didn't improve ----
      if (
        iteration >= 2 &&
        gfoaResult.totalScore <= previousGfoaScore
      ) {
        console.log(
          `[budget-book] Score plateau detected (${previousGfoaScore} → ${gfoaResult.totalScore}). Stopping iterations.`
        );
        break;
      }
      previousGfoaScore = gfoaResult.totalScore;

      // ---- Revise sections based on feedback ----
      await updateBookStatus(ctx.db, budgetBookId, "revision");
      await updateJobStatus(
        ctx.db,
        budgetBookId,
        "revise_sections",
        "running",
        0,
        `Revising sections — iteration ${iteration}...`
      );

      const revisedSections: SectionOutput[] = [];
      for (const section of currentSections) {
        const gfoaFeedbackForSection = gfoaResult.recommendations
          .filter((r) => r.section === section.sectionType)
          .map((r) => `[${r.priority}] ${r.issue}: ${r.suggestion}`);

        const adaFeedbackForSection = [
          ...adaResult.pdfIssues.filter((i) =>
            i.location
              .toLowerCase()
              .includes(section.sectionType.replace(/_/g, " "))
          ),
          ...adaResult.webIssues.filter((i) =>
            i.location
              .toLowerCase()
              .includes(section.sectionType.replace(/_/g, " "))
          ),
        ].map(
          (i) => `[${i.severity}] ${i.rule}: ${i.description} — Fix: ${i.fix}`
        );

        if (
          gfoaFeedbackForSection.length > 0 ||
          adaFeedbackForSection.length > 0
        ) {
          const revised = await reviseSection(
            ctx,
            docType,
            section,
            gfoaFeedbackForSection,
            adaFeedbackForSection,
            budgetData,
            styleAnalysis
          );
          revisedSections.push(revised);
        } else {
          revisedSections.push(section);
        }
      }

      currentSections = revisedSections;

      // Re-render charts for revised sections and update DB
      for (const section of currentSections) {
        const s3Keys = await renderAndUploadCharts(
          ctx,
          section,
          budgetBookId,
          `-rev${iteration}`
        );

        await ctx.db
          .update(documentSections)
          .set({
            narrativeContent: section.narrativeContent,
            tableData: section.tableData,
            chartConfigs:
              section.chartConfigs as unknown as Record<string, unknown>[],
            chartImageS3Keys: s3Keys,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(documentSections.documentId, budgetBookId),
              eq(documentSections.sectionType, section.sectionType)
            )
          );
      }

      await updateJobStatus(
        ctx.db,
        budgetBookId,
        "revise_sections",
        "completed",
        100,
        "Revisions applied"
      );
    }

    // ---- Step 8: Render final PDF ----
    await updateJobStatus(
      ctx.db,
      budgetBookId,
      "render_pdf",
      "running",
      0,
      "Rendering final PDF..."
    );

    const sectionRows = await ctx.db
      .select()
      .from(documentSections)
      .where(eq(documentSections.documentId, budgetBookId))
      .orderBy(documentSections.sectionOrder);

    const chartImages: Map<string, Buffer[]> = new Map();
    for (const row of sectionRows) {
      const keys = (row.chartImageS3Keys as string[]) ?? [];
      if (keys.length > 0) {
        const buffers = await Promise.all(
          keys.map((k: string) => ctx.storage.getObject(k))
        );
        chartImages.set(row.sectionType, buffers);
      }
    }

    const pdfBuffer = docType.renderPdf
      ? await docType.renderPdf(currentSections, budgetData, styleAnalysis, chartImages)
      : Buffer.from("PDF rendering not supported for this document type");

    const pdfKey = `${ctx.tenantId}/budget-books/${budgetBookId}/budget-book-fy${fiscalYear}.pdf`;
    await ctx.storage.upload(pdfKey, pdfBuffer, "application/pdf");

    await ctx.db
      .update(documents)
      .set({
        generatedPdfS3Key: pdfKey,
        webPreviewData:
          currentSections as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, budgetBookId));

    await updateJobStatus(
      ctx.db,
      budgetBookId,
      "render_pdf",
      "completed",
      100,
      "PDF rendered and uploaded"
    );

    // ---- Step 9: Finalize — set status based on open todos ----
    await updateJobStatus(
      ctx.db,
      budgetBookId,
      "finalize",
      "running",
      0,
      "Finalizing..."
    );

    const openTodos = await ctx.db
      .select({ id: documentTodos.id })
      .from(documentTodos)
      .where(
        and(
          eq(documentTodos.documentId, budgetBookId),
          eq(documentTodos.status, "open")
        )
      )
      .limit(1);

    const finalStatus =
      openTodos.length > 0 ? "completed_with_todos" : "completed";
    await updateBookStatus(ctx.db, budgetBookId, finalStatus);
    await updateJobStatus(
      ctx.db,
      budgetBookId,
      "finalize",
      "completed",
      100,
      finalStatus === "completed_with_todos"
        ? "Budget book generated — action items need attention"
        : "Budget book generation complete"
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    await updateBookStatus(ctx.db, budgetBookId, "failed");

    await ctx.db
      .update(documentJobs)
      .set({
        status: "failed",
        error: message,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(documentJobs.documentId, budgetBookId),
          eq(documentJobs.status, "running")
        )
      );

    throw error;
  }
}

// ---- Regeneration (resume after user addresses todos) ----

export async function resumeBudgetBookGeneration(
  ctx: EngineContext,
  budgetBookId: string
): Promise<void> {
  const [book] = await ctx.db
    .select()
    .from(documents)
    .where(eq(documents.id, budgetBookId))
    .limit(1);

  if (!book) {
    throw new Error(`Budget book ${budgetBookId} not found`);
  }

  if (
    book.status !== "completed" &&
    book.status !== "completed_with_todos" &&
    book.status !== "failed"
  ) {
    throw new Error(
      `Cannot regenerate budget book in status "${book.status}"`
    );
  }

  // Clean up previous generation artifacts
  await ctx.db
    .delete(documentSections)
    .where(eq(documentSections.documentId, budgetBookId));
  await ctx.db
    .delete(documentReviews)
    .where(eq(documentReviews.documentId, budgetBookId));
  await ctx.db
    .delete(documentJobs)
    .where(eq(documentJobs.documentId, budgetBookId));

  // Reset book state
  await ctx.db
    .update(documents)
    .set({
      status: "draft",
      currentIteration: 0,
      generatedPdfS3Key: null,
      webPreviewData: null,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, budgetBookId));

  // Run full generation again (with updated data + accumulated skills)
  await orchestrateBudgetBookGeneration(ctx, budgetBookId);
}
