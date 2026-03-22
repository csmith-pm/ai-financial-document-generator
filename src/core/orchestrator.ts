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
  budgetBooks,
  budgetBookSections,
  budgetBookReviews,
  budgetBookJobs,
  budgetBookTodos,
  budgetBookStatusEnum,
} from "../db/schema.js";
import type { BudgetBookData } from "./providers.js";
import { parseExcelBudget } from "./excelParser.js";
import { analyzePriorYearPdf } from "./pdfAnalyzer.js";
import type { StyleAnalysis } from "./types.js";
import { renderChartsForSection } from "./chartRenderer.js";
import { renderBudgetBookPdf } from "./budgetBookPdf.js";
import { buildAgentPrompt, getAgentDefinition } from "./agents/index.js";
import { seedGlobalSkills } from "./skills/seeds.js";
import {
  extractSkillsFromGfoaReview,
  extractSkillsFromAdaReview,
} from "./skills/extractor.js";
import { detectDataGaps } from "./todos/detector.js";
import {
  createTodosFromDataGaps,
  createTodosFromGfoaReview,
} from "./todos/creator.js";
import type { ChartConfig } from "./chartTypes.js";
import type { EngineContext } from "./context.js";
import type { DrizzleInstance } from "../db/connection.js";

const SECTION_TYPES = [
  "executive_summary",
  "community_profile",
  "revenue_summary",
  "expenditure_summary",
  "personnel_summary",
  "capital_summary",
  "multi_year_outlook",
  "appendix",
  "cover",
  "toc",
] as const;

type SectionType = (typeof SECTION_TYPES)[number];

interface SectionOutput {
  sectionType: SectionType;
  title: string;
  narrativeContent: string;
  tableData: Record<string, unknown>[];
  chartConfigs: ChartConfig[];
}

interface GfoaScore {
  category: string;
  maxPoints: number;
  awardedPoints: number;
  feedback: string;
}

interface GfoaReviewResult {
  scores: GfoaScore[];
  totalScore: number;
  passed: boolean;
  recommendations: Array<{
    section: string;
    priority: "high" | "medium" | "low";
    issue: string;
    suggestion: string;
  }>;
}

interface AdaIssue {
  rule: string;
  severity: "critical" | "major" | "minor";
  location: string;
  description: string;
  fix: string;
}

interface AdaReviewResult {
  pdfIssues: AdaIssue[];
  webIssues: AdaIssue[];
  passed: boolean;
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
    .update(budgetBookJobs)
    .set(setFields)
    .where(
      and(
        eq(budgetBookJobs.budgetBookId, budgetBookId),
        eq(budgetBookJobs.jobType, jobType)
      )
    );
}

type BookStatus = (typeof budgetBookStatusEnum.enumValues)[number];

async function updateBookStatus(
  db: DrizzleInstance,
  budgetBookId: string,
  status: BookStatus
): Promise<void> {
  await db
    .update(budgetBooks)
    .set({ status, updatedAt: new Date() })
    .where(eq(budgetBooks.id, budgetBookId));
}

// ---- Section Data Slicing ----

function getSectionData(
  sectionType: SectionType,
  data: BudgetBookData
): Record<string, unknown> {
  switch (sectionType) {
    case "executive_summary":
      return {
        executiveSummary: data.executiveSummary,
        fiscalYear: data.fiscalYear,
        communityProfile: data.communityProfile,
      };
    case "community_profile":
      return { communityProfile: data.communityProfile };
    case "revenue_summary":
      return { revenueDetail: data.revenueDetail, fiscalYear: data.fiscalYear };
    case "expenditure_summary":
      return {
        expenditureByDepartment: data.expenditureByDepartment,
        fiscalYear: data.fiscalYear,
      };
    case "personnel_summary":
      return {
        personnelDetail: data.personnelDetail,
        fiscalYear: data.fiscalYear,
      };
    case "capital_summary":
      return { capitalDetail: data.capitalProjects, fiscalYear: data.fiscalYear };
    case "multi_year_outlook":
      return {
        multiYearProjections: data.multiYearProjections,
        executiveSummary: data.executiveSummary,
        fiscalYear: data.fiscalYear,
      };
    case "appendix":
      return {
        fiscalYear: data.fiscalYear,
        communityProfile: data.communityProfile,
      };
    case "cover":
      return {
        fiscalYear: data.fiscalYear,
        communityProfile: data.communityProfile,
      };
    case "toc":
      return { fiscalYear: data.fiscalYear };
    default:
      return { fiscalYear: data.fiscalYear };
  }
}

// ---- Section Generation (using agent definitions + skills) ----

function getSectionPrompt(
  sectionType: SectionType,
  data: BudgetBookData,
  styleAnalysis: StyleAnalysis | null
): string {
  const styleGuidance = styleAnalysis
    ? `\n\nStyle guidance from prior-year budget book:\n- Tone: ${styleAnalysis.narrativeTone}\n- Chart types used: ${styleAnalysis.chartTypes.join(", ")}\n- Overall style: ${styleAnalysis.overallStyle}`
    : "";

  const base = `Generate the "${sectionType}" section for a FY${data.fiscalYear} municipal budget book for ${data.communityProfile.name}.${styleGuidance}`;
  const dataSlice = getSectionData(sectionType, data);

  return `${base}\n\nRelevant data:\n${JSON.stringify(dataSlice, null, 2)}\n\nRespond with JSON matching this structure:\n{\n  "sectionType": "${sectionType}",\n  "title": "Section Title",\n  "narrativeContent": "Professional prose with specific dollar amounts...",\n  "tableData": [{"header": true, "cells": ["Col1", "Col2"]}, {"cells": ["val1", "val2"]}],\n  "chartConfigs": [{"type": "bar|pie|line|stacked-bar|grouped-bar", "title": "...", "categoryKey": "...", "dataKeys": ["..."], "width": 800, "height": 400, "data": [...]}]\n}`;
}

async function generateSection(
  ctx: EngineContext,
  sectionType: SectionType,
  data: BudgetBookData,
  styleAnalysis: StyleAnalysis | null
): Promise<SectionOutput> {
  const systemPrompt = await buildAgentPrompt(ctx.db, "bb_creator", ctx.tenantId);
  const userPrompt = getSectionPrompt(sectionType, data, styleAnalysis);
  const definition = getAgentDefinition("bb_creator");

  const result = await ctx.ai.callJson<SectionOutput>(
    systemPrompt,
    userPrompt,
    { maxTokens: definition.maxTokens, temperature: definition.temperature }
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
  sections: SectionOutput[]
): Promise<GfoaReviewResult> {
  const systemPrompt = await buildAgentPrompt(ctx.db, "bb_reviewer", ctx.tenantId);
  const definition = getAgentDefinition("bb_reviewer");

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
  sections: SectionOutput[]
): Promise<AdaReviewResult> {
  const systemPrompt = await buildAgentPrompt(ctx.db, "ada_reviewer", ctx.tenantId);
  const definition = getAgentDefinition("ada_reviewer");

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
  section: SectionOutput,
  gfoaFeedback: string[],
  adaFeedback: string[],
  data: BudgetBookData,
  _styleAnalysis: StyleAnalysis | null
): Promise<SectionOutput> {
  const systemPrompt = await buildAgentPrompt(ctx.db, "bb_creator", ctx.tenantId);
  const definition = getAgentDefinition("bb_creator");

  // Revision gets a more targeted prompt than initial generation
  const revisionSystemPrompt = `${systemPrompt}\n\nYou are revising an existing section based on reviewer feedback. Make targeted improvements to address the specific issues raised. Maintain the same overall structure and data. Respond with valid JSON in the same format as the original section.`;

  const userPrompt = `Original section:\n${JSON.stringify(section, null, 2)}\n\nGFOA feedback for this section:\n${gfoaFeedback.join("\n")}\n\nADA feedback for this section:\n${adaFeedback.join("\n")}\n\nBudget data context:\n${JSON.stringify(getSectionData(section.sectionType, data), null, 2)}`;

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
    .from(budgetBooks)
    .where(eq(budgetBooks.id, budgetBookId))
    .limit(1);

  if (!book) {
    throw new Error(`Budget book ${budgetBookId} not found`);
  }

  const fiscalYear = book.fiscalYear ?? new Date().getFullYear();

  try {
    // ---- Step 0: Seed global skills (idempotent) ----
    await seedGlobalSkills(ctx.db);

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
    if (book.priorYearPdfS3Key) {
      styleAnalysis = await analyzePriorYearPdf(
        ctx.ai,
        ctx.storage,
        ctx.tenantId,
        book.priorYearPdfS3Key
      );
      await ctx.db
        .update(budgetBooks)
        .set({
          styleAnalysis:
            styleAnalysis as unknown as Record<string, unknown>,
        })
        .where(eq(budgetBooks.id, budgetBookId));
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

    if (book.dataSource === "upload" && book.uploadedBudgetS3Key) {
      // Upload path: parse the Excel file with Claude
      const excelBuffer = await ctx.storage.getObject(book.uploadedBudgetS3Key);
      budgetData = await parseExcelBudget(ctx.ai, excelBuffer, fiscalYear);
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
    const dataGaps = detectDataGaps(budgetData);
    if (dataGaps.length > 0) {
      await createTodosFromDataGaps(ctx.db, budgetBookId, ctx.tenantId, dataGaps);
      console.log(
        `[budget-book] Created ${dataGaps.length} data gap todo(s) — continuing generation with available data`
      );
    }

    // ---- Step 3: Generate sections (parallel where independent) ----
    const sections: SectionOutput[] = [];
    const contentSections = SECTION_TYPES.filter(
      (t) => t !== "cover" && t !== "toc"
    );

    // Parallel batch: independent sections
    const parallelSections: SectionType[] = [
      "revenue_summary",
      "expenditure_summary",
      "personnel_summary",
      "capital_summary",
    ];
    const sequentialSections = contentSections.filter(
      (t) => !parallelSections.includes(t as SectionType)
    );

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
      parallelSections.map((st) =>
        generateSection(ctx, st, budgetData, styleAnalysis)
      )
    );
    sections.push(...parallelResults);

    // Run sequential sections (executive summary depends on data sections for context)
    for (let i = 0; i < sequentialSections.length; i++) {
      const sectionType = sequentialSections[i] as SectionType;
      const progress = Math.round(
        50 + ((i + 1) / sequentialSections.length) * 30
      );
      await updateJobStatus(
        ctx.db,
        budgetBookId,
        "generate_sections",
        "running",
        progress,
        `Generating ${sectionType.replace(/_/g, " ")}...`
      );
      const section = await generateSection(
        ctx,
        sectionType,
        budgetData,
        styleAnalysis
      );
      sections.push(section);
    }

    // Generate cover and TOC
    const [cover, toc] = await Promise.all([
      generateSection(ctx, "cover", budgetData, styleAnalysis),
      generateSection(ctx, "toc", budgetData, styleAnalysis),
    ]);
    sections.push(cover, toc);

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

      await ctx.db.insert(budgetBookSections).values({
        budgetBookId,
        tenantId: ctx.tenantId,
        sectionType: section.sectionType,
        sectionOrder: SECTION_TYPES.indexOf(section.sectionType),
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
        .update(budgetBooks)
        .set({ currentIteration: iteration })
        .where(eq(budgetBooks.id, budgetBookId));

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
        runGfoaReview(ctx, currentSections),
        runAdaReview(ctx, currentSections),
      ]);

      // Save GFOA review (capture the ID for skill extraction + todo linking)
      const [gfoaReviewRow] = await ctx.db
        .insert(budgetBookReviews)
        .values({
          budgetBookId,
          tenantId: ctx.tenantId,
          reviewerType: "gfoa",
          iteration,
          overallScore: String(gfoaResult.totalScore),
          passed: gfoaResult.passed,
          report: gfoaResult as unknown as Record<string, unknown>,
          recommendations:
            gfoaResult.recommendations as unknown as Record<string, unknown>[],
        })
        .returning({ id: budgetBookReviews.id });

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
        .insert(budgetBookReviews)
        .values({
          budgetBookId,
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
        .returning({ id: budgetBookReviews.id });

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
          .update(budgetBookSections)
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
              eq(budgetBookSections.budgetBookId, budgetBookId),
              eq(budgetBookSections.sectionType, section.sectionType)
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
      .from(budgetBookSections)
      .where(eq(budgetBookSections.budgetBookId, budgetBookId))
      .orderBy(budgetBookSections.sectionOrder);

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

    const pdfBuffer = await renderBudgetBookPdf(
      currentSections as unknown as Array<{
        sectionType: string;
        title: string;
        narrativeContent: string;
        tableData: Record<string, unknown>[];
        chartConfigs: Record<string, unknown>[];
      }>,
      budgetData,
      styleAnalysis,
      chartImages
    );

    const pdfKey = `${ctx.tenantId}/budget-books/${budgetBookId}/budget-book-fy${fiscalYear}.pdf`;
    await ctx.storage.upload(pdfKey, pdfBuffer, "application/pdf");

    await ctx.db
      .update(budgetBooks)
      .set({
        generatedPdfS3Key: pdfKey,
        webPreviewData:
          currentSections as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(budgetBooks.id, budgetBookId));

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
      .select({ id: budgetBookTodos.id })
      .from(budgetBookTodos)
      .where(
        and(
          eq(budgetBookTodos.budgetBookId, budgetBookId),
          eq(budgetBookTodos.status, "open")
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
      .update(budgetBookJobs)
      .set({
        status: "failed",
        error: message,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(budgetBookJobs.budgetBookId, budgetBookId),
          eq(budgetBookJobs.status, "running")
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
    .from(budgetBooks)
    .where(eq(budgetBooks.id, budgetBookId))
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
    .delete(budgetBookSections)
    .where(eq(budgetBookSections.budgetBookId, budgetBookId));
  await ctx.db
    .delete(budgetBookReviews)
    .where(eq(budgetBookReviews.budgetBookId, budgetBookId));
  await ctx.db
    .delete(budgetBookJobs)
    .where(eq(budgetBookJobs.budgetBookId, budgetBookId));

  // Reset book state
  await ctx.db
    .update(budgetBooks)
    .set({
      status: "draft",
      currentIteration: 0,
      generatedPdfS3Key: null,
      webPreviewData: null,
      updatedAt: new Date(),
    })
    .where(eq(budgetBooks.id, budgetBookId));

  // Run full generation again (with updated data + accumulated skills)
  await orchestrateBudgetBookGeneration(ctx, budgetBookId);
}
