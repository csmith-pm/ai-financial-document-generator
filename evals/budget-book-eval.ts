/**
 * Budget Book Evaluation Runner.
 *
 * Runs the full 11-step pipeline against real fixture files and collects
 * structured results for scoring and reporting.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { eq } from "drizzle-orm";
import { createPool, createDb } from "../src/db/connection.js";
import {
  documents,
  documentJobs,
  documentSections,
  documentReviews,
  documentTodos,
} from "../src/db/schema.js";
import { AnthropicAiProvider } from "../src/providers/anthropic.js";
import { LocalStorageProvider } from "../src/providers/local-storage.js";
import { BullMQQueueProvider } from "../src/providers/bullmq.js";
import { orchestrateDocumentGeneration } from "../src/core/orchestrator.js";
import { buildDefaultPipeline } from "../src/core/pipeline/index.js";
import type { EngineContext } from "../src/core/context.js";
import type { DataProvider } from "../src/core/providers.js";
import type { EvalManifest, EvalResult, StepResult } from "./types.js";

// ─── Setup ──────────────────────────────────────────────────────────────────

function loadManifest(fixtureDir: string): EvalManifest {
  const manifestPath = path.join(fixtureDir, "manifest.json");
  return JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as EvalManifest;
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

// ─── Eval Runner ────────────────────────────────────────────────────────────

export async function runEval(fixtureDir: string): Promise<EvalResult> {
  const startTime = Date.now();
  const manifest = loadManifest(fixtureDir);

  console.log(`\n📋 Eval: ${manifest.name}`);
  console.log(`   ${manifest.description}\n`);

  // Set up providers
  const pool = createPool(requireEnv("DATABASE_URL"));
  const db = createDb(pool);
  const ai = new AnthropicAiProvider({
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
    defaultModel: process.env.DEFAULT_MODEL,
  });
  const storage = new LocalStorageProvider({
    baseDir: process.env.LOCAL_STORAGE_DIR ?? "./storage",
  });
  const noopData: DataProvider = {
    async getDocumentData() { throw new Error("Eval uses upload path"); },
  };

  const ctx: EngineContext = {
    db,
    ai,
    storage,
    data: noopData,
    tenantId: manifest.tenantId,
    config: {
      maxIterations: 3,
      chartsEnabled: true,
      defaultModel: process.env.DEFAULT_MODEL,
    },
  };

  try {
    // 1. Upload fixture files to storage
    console.log("📁 Uploading fixture files...");
    const dataFileKey = `${manifest.tenantId}/budget-books/eval/data-file.xlsx`;
    const priorPdfKey = `${manifest.tenantId}/budget-books/eval/prior-document.pdf`;

    const dataBuffer = fs.readFileSync(path.join(fixtureDir, manifest.dataFiles[0]!));
    await storage.upload(dataFileKey, dataBuffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    const pdfBuffer = fs.readFileSync(path.join(fixtureDir, manifest.priorDocumentPdf));
    await storage.upload(priorPdfKey, pdfBuffer, "application/pdf");

    // 2. Create document record
    console.log("📝 Creating document record...");
    const [doc] = await db.insert(documents).values({
      tenantId: manifest.tenantId,
      docType: manifest.docType,
      title: `[EVAL] ${manifest.name}`,
      fiscalYear: manifest.fiscalYear,
      dataSource: "upload",
      uploadedDataS3Key: dataFileKey,
      priorYearPdfS3Key: priorPdfKey,
      maxIterations: 3,
      createdBy: "eval-runner",
    }).returning();

    const documentId = doc!.id;

    // 3. Create job tracking rows
    const pipeline = buildDefaultPipeline();
    for (const step of pipeline) {
      await db.insert(documentJobs).values({
        documentId,
        tenantId: manifest.tenantId,
        jobType: step.id,
        status: "pending",
        progress: 0,
      });
    }

    // 4. Run the pipeline
    console.log("🚀 Running pipeline...");
    const pipelineStart = Date.now();

    try {
      await orchestrateDocumentGeneration(ctx, documentId);
    } catch (err) {
      console.error("❌ Pipeline failed:", (err as Error).message);
    }

    const pipelineDuration = Date.now() - pipelineStart;

    // 5. Collect results
    console.log("📊 Collecting results...");
    const result = await collectResults(db, documentId, manifest, pipelineDuration);
    result.duration = Date.now() - startTime;

    // 6. Save output
    const outputDir = path.join(fixtureDir, "output");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(
      path.join(outputDir, "eval-result.json"),
      JSON.stringify(result, null, 2)
    );

    return result;
  } finally {
    await pool.end();
  }
}

// ─── Result Collection ──────────────────────────────────────────────────────

async function collectResults(
  db: ReturnType<typeof createDb>,
  documentId: string,
  manifest: EvalManifest,
  pipelineDuration: number,
): Promise<EvalResult> {
  // Document status
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  // Job results
  const jobs = await db
    .select()
    .from(documentJobs)
    .where(eq(documentJobs.documentId, documentId))
    .orderBy(documentJobs.createdAt);

  const stepResults: StepResult[] = jobs.map((j) => ({
    stepId: j.jobType,
    stepName: j.jobType.replace(/_/g, " "),
    status: j.status,
    duration: j.startedAt && j.completedAt
      ? new Date(j.completedAt).getTime() - new Date(j.startedAt).getTime()
      : 0,
    message: j.message ?? "",
    error: j.error ?? undefined,
  }));

  // Sections
  const sections = await db
    .select()
    .from(documentSections)
    .where(eq(documentSections.documentId, documentId));

  // Reviews
  const reviews = await db
    .select()
    .from(documentReviews)
    .where(eq(documentReviews.documentId, documentId));

  // Todos
  const todos = await db
    .select()
    .from(documentTodos)
    .where(eq(documentTodos.documentId, documentId));

  // Parse GFOA review
  const gfoaReview = reviews.find((r) => r.reviewerType === "gfoa");
  const adaReview = reviews.find((r) => r.reviewerType === "ada");

  // Parse document data for quality check
  const styleAnalysis = doc?.styleAnalysis as Record<string, unknown> | null;
  const priorSectionCount = (styleAnalysis as { sectionOrder?: string[] })?.sectionOrder?.length ?? 0;

  // Estimate pages from narrative length (rough: ~3000 chars per page)
  const totalNarrative = sections.reduce((sum, s) => sum + (s.narrativeContent?.length ?? 0), 0);
  const estimatedPages = Math.ceil(totalNarrative / 3000) + sections.length; // +1 page per section for tables/charts

  // Build data quality assessment
  const docData = doc as Record<string, unknown> | null;
  const documentAnalysis = {
    totalSections: sections.length,
    sectionsWithNarrative: sections.filter((s) => (s.narrativeContent?.length ?? 0) > 50).length,
    sectionsWithTables: sections.filter((s) => {
      const td = s.tableData as unknown[];
      return td && td.length > 0;
    }).length,
    sectionsWithCharts: sections.filter((s) => {
      const cc = s.chartConfigs as unknown[];
      return cc && cc.length > 0;
    }).length,
    totalNarrativeLength: totalNarrative,
    priorPdfSections: priorSectionCount,
  };

  // Parse review details
  const gfoaResult = gfoaReview ? parseGfoaReview(gfoaReview) : null;
  const adaResult = adaReview ? parseAdaReview(adaReview) : null;

  // Comparison
  const comparison = {
    priorSectionCount: priorSectionCount || manifest.expectations.expectedSections,
    generatedSectionCount: sections.length,
    sectionCoveragePercent: priorSectionCount > 0
      ? Math.round((sections.length / priorSectionCount) * 100)
      : 0,
    priorEstimatedPages: manifest.expectations.minPageCount,
    generatedEstimatedPages: estimatedPages,
    pageLengthRatio: manifest.expectations.minPageCount > 0
      ? Math.round((estimatedPages / manifest.expectations.minPageCount) * 100) / 100
      : 0,
  };

  // Score
  const { score, grade, recommendations } = computeScore(
    doc?.status as string,
    stepResults,
    gfoaResult,
    adaResult,
    documentAnalysis,
    comparison,
    todos,
    manifest,
  );

  return {
    testName: manifest.name,
    description: manifest.description,
    timestamp: new Date().toISOString(),
    duration: pipelineDuration,
    pipelineStatus: (doc?.status as "completed" | "completed_with_todos" | "failed") ?? "failed",
    stepResults,
    documentAnalysis,
    gfoaReview: gfoaResult,
    adaReview: adaResult,
    dataQuality: {
      revenueRowsFound: sections.some((s) => s.sectionType === "revenue_summary") ? 1 : 0,
      expenditureRowsFound: sections.some((s) => s.sectionType === "expenditure_summary") ? 1 : 0,
      totalRevenue: 0, // Would need to parse from section content
      totalExpenditure: 0,
      communityProfilePopulated: sections.some((s) =>
        s.sectionType === "community_profile" && (s.narrativeContent?.length ?? 0) > 100
      ),
      capitalProjectsFound: sections.some((s) => s.sectionType === "capital_summary") ? 1 : 0,
      multiYearProjectionsYears: sections.some((s) => s.sectionType === "multi_year_outlook") ? 1 : 0,
    },
    todos: todos.map((t) => ({
      category: t.category,
      title: t.title,
      priority: t.priority,
      status: t.status,
      sectionType: t.sectionType,
    })),
    comparison,
    overallScore: score,
    grade,
    recommendations,
  };
}

// ─── Review Parsers ─────────────────────────────────────────────────────────

function parseGfoaReview(review: typeof documentReviews.$inferSelect) {
  const report = review.report as Record<string, unknown> | null;
  const recs = review.recommendations as Array<Record<string, unknown>> | null;

  return {
    passed: review.passed ?? false,
    score: Number(review.overallScore ?? 0),
    maxScore: 160,
    categories: report?.categories
      ? (report.categories as Array<{ name: string; score: number; maxScore: number; feedback: string }>)
      : [],
    recommendations: recs?.map((r) => String(r.recommendation ?? r.description ?? "")) ?? [],
  };
}

function parseAdaReview(review: typeof documentReviews.$inferSelect) {
  const report = review.report as Record<string, unknown> | null;
  const recs = review.recommendations as Array<Record<string, unknown>> | null;

  return {
    passed: review.passed ?? false,
    score: Number(review.overallScore ?? 0),
    issues: recs?.map((r) => String(r.issue ?? r.recommendation ?? r.description ?? "")) ?? [],
  };
}

// ─── Scoring ────────────────────────────────────────────────────────────────

function computeScore(
  status: string,
  steps: StepResult[],
  gfoa: EvalResult["gfoaReview"],
  ada: EvalResult["adaReview"],
  analysis: EvalResult["documentAnalysis"],
  comparison: EvalResult["comparison"],
  todos: typeof documentTodos.$inferSelect[],
  manifest: EvalManifest,
): { score: number; grade: string; recommendations: string[] } {
  let score = 0;
  const recommendations: string[] = [];

  // Pipeline completion (10 pts)
  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const pipelineScore = Math.round((completedSteps / steps.length) * 10);
  score += pipelineScore;
  if (pipelineScore < 10) {
    const failed = steps.filter((s) => s.status === "failed");
    recommendations.push(
      `**Fix pipeline failures** — ${failed.length} step(s) failed: ${failed.map((s) => s.stepId).join(", ")}. Check error messages for root cause.`
    );
  }

  // GFOA score (25 pts)
  if (gfoa) {
    const gfoaPercent = gfoa.maxScore > 0 ? gfoa.score / gfoa.maxScore : 0;
    const gfoaPoints = Math.round(gfoaPercent * 25);
    score += gfoaPoints;
    if (gfoaPercent < 0.6) {
      recommendations.push(
        `**Improve GFOA score** — Currently ${gfoa.score}/${gfoa.maxScore} (${Math.round(gfoaPercent * 100)}%). Target is 60%+. Focus on lowest-scoring categories.`
      );
    }
  }

  // ADA score (15 pts)
  if (ada) {
    const adaPoints = ada.passed ? 15 : Math.round((ada.score / 100) * 15);
    score += adaPoints;
    if (!ada.passed) {
      recommendations.push(
        `**Fix accessibility issues** — ${ada.issues.length} issue(s) found. WCAG 2.1 AA compliance is required for GFOA award eligibility.`
      );
    }
  }

  // Section coverage (20 pts)
  const coveragePercent = comparison.sectionCoveragePercent / 100;
  const coveragePoints = Math.round(Math.min(coveragePercent, 1) * 20);
  score += coveragePoints;
  if (coveragePercent < 0.8) {
    recommendations.push(
      `**Increase section coverage** — Generated ${comparison.generatedSectionCount} sections vs ${comparison.priorSectionCount} in prior year (${comparison.sectionCoveragePercent}%). Add more section types to the budget book definition to match the prior document's structure.`
    );
  }

  // Page length ratio (10 pts)
  const ratio = comparison.pageLengthRatio;
  const ratioDistance = Math.abs(1 - ratio);
  const ratioPoints = Math.round(Math.max(0, 1 - ratioDistance) * 10);
  score += ratioPoints;
  if (ratio < 0.5) {
    recommendations.push(
      `**Document is too short** — Estimated ${comparison.generatedEstimatedPages} pages vs ${comparison.priorEstimatedPages} prior (${Math.round(ratio * 100)}%). Sections need more narrative depth, tables, and charts.`
    );
  } else if (ratio > 1.5) {
    recommendations.push(
      `**Document is too long** — Estimated ${comparison.generatedEstimatedPages} pages vs ${comparison.priorEstimatedPages} prior. Consider trimming excessive narrative.`
    );
  }

  // Data completeness (10 pts)
  let dataPoints = 0;
  if (analysis.sectionsWithNarrative > 0) dataPoints += 3;
  if (analysis.sectionsWithTables > 0) dataPoints += 3;
  if (analysis.sectionsWithCharts > 0) dataPoints += 4;
  score += dataPoints;
  if (analysis.sectionsWithCharts === 0) {
    recommendations.push(
      `**Add chart visualizations** — No charts were generated. Charts are critical for GFOA scoring and reader engagement.`
    );
  }

  // Community profile (5 pts)
  const hasProfile = analysis.totalSections > 0; // rough proxy
  score += hasProfile ? 5 : 0;

  // Todos severity (5 pts)
  const highTodos = todos.filter((t) => t.priority === "high").length;
  const todoPoints = Math.max(0, 5 - highTodos);
  score += todoPoints;
  if (highTodos > 2) {
    recommendations.push(
      `**Address high-priority data gaps** — ${highTodos} high-priority todo(s) indicate missing critical data. These directly impact document quality.`
    );
  }

  // Grade
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";

  return { score, grade, recommendations };
}
