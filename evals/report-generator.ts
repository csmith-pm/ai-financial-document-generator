/**
 * Eval Report Generator — formats EvalResult into a readable markdown report.
 */

import type { EvalResult } from "./types.js";

export function generateReport(result: EvalResult): string {
  const lines: string[] = [];
  const hr = "---";

  // Header
  lines.push(`# Eval Report: ${result.testName}`);
  lines.push(`**Date:** ${new Date(result.timestamp).toLocaleDateString()} | **Duration:** ${formatDuration(result.duration)} | **Grade: ${result.grade} (${result.overallScore}/100)**`);
  lines.push("");
  lines.push(`> ${result.description}`);
  lines.push("");
  lines.push(hr);
  lines.push("");

  // Pipeline Execution
  lines.push("## Pipeline Execution");
  const allCompleted = result.stepResults.every((s) => s.status === "completed");
  lines.push(allCompleted
    ? `All ${result.stepResults.length} steps completed successfully.`
    : `${result.stepResults.filter((s) => s.status === "completed").length}/${result.stepResults.length} steps completed.`
  );
  lines.push("");
  lines.push("| Step | Duration | Status | Message |");
  lines.push("|------|----------|--------|---------|");
  for (const step of result.stepResults) {
    const icon = step.status === "completed" ? "pass" : step.status === "failed" ? "FAIL" : step.status;
    const dur = step.duration > 0 ? formatDuration(step.duration) : "-";
    const msg = step.error ? `ERROR: ${step.error.slice(0, 80)}` : step.message.slice(0, 60);
    lines.push(`| ${step.stepName} | ${dur} | ${icon} | ${msg} |`);
  }
  lines.push("");
  lines.push(hr);
  lines.push("");

  // Review Scores
  lines.push("## Review Scores");
  lines.push("");

  if (result.gfoaReview) {
    const g = result.gfoaReview;
    lines.push(`### GFOA Distinguished Budget Presentation: ${g.score}/${g.maxScore} ${g.passed ? "(PASSED)" : ""}`);
    lines.push("");
    if (g.categories.length > 0) {
      lines.push("| Category | Score | Max | Feedback |");
      lines.push("|----------|-------|-----|----------|");
      for (const cat of g.categories) {
        lines.push(`| ${cat.name} | ${cat.score} | ${cat.maxScore} | ${cat.feedback.slice(0, 80)} |`);
      }
      lines.push("");
    }
    if (g.recommendations.length > 0) {
      lines.push("**GFOA Recommendations:**");
      for (const rec of g.recommendations.slice(0, 10)) {
        lines.push(`- ${rec}`);
      }
      lines.push("");
    }
  } else {
    lines.push("*GFOA review not available — pipeline may not have reached review step.*");
    lines.push("");
  }

  if (result.adaReview) {
    const a = result.adaReview;
    lines.push(`### ADA/WCAG Accessibility: ${a.passed ? "PASSED" : "FAILED"} (${a.score}/100)`);
    lines.push("");
    if (a.issues.length > 0) {
      lines.push("**Issues found:**");
      for (const issue of a.issues.slice(0, 10)) {
        lines.push(`- ${issue}`);
      }
      lines.push("");
    }
  } else {
    lines.push("*ADA review not available.*");
    lines.push("");
  }

  lines.push(hr);
  lines.push("");

  // Document Comparison
  lines.push("## Document Comparison");
  lines.push("");
  lines.push("| Metric | Prior Year | Generated | Ratio |");
  lines.push("|--------|-----------|-----------|-------|");
  lines.push(`| Sections | ${result.comparison.priorSectionCount} | ${result.comparison.generatedSectionCount} | ${result.comparison.sectionCoveragePercent}% |`);
  lines.push(`| Est. Pages | ~${result.comparison.priorEstimatedPages} | ~${result.comparison.generatedEstimatedPages} | ${Math.round(result.comparison.pageLengthRatio * 100)}% |`);
  lines.push("");
  lines.push(hr);
  lines.push("");

  // Document Analysis
  lines.push("## Document Analysis");
  lines.push("");
  const da = result.documentAnalysis;
  lines.push(`- **Total sections generated:** ${da.totalSections}`);
  lines.push(`- **Sections with narrative:** ${da.sectionsWithNarrative}`);
  lines.push(`- **Sections with tables:** ${da.sectionsWithTables}`);
  lines.push(`- **Sections with charts:** ${da.sectionsWithCharts}`);
  lines.push(`- **Total narrative length:** ${(da.totalNarrativeLength / 1000).toFixed(1)}K characters`);
  lines.push("");
  lines.push(hr);
  lines.push("");

  // Data Quality
  lines.push("## Data Quality");
  lines.push("");
  const dq = result.dataQuality;
  lines.push(`- ${dq.revenueRowsFound > 0 ? "pass" : "FAIL"} Revenue data: ${dq.revenueRowsFound > 0 ? "present" : "missing"}`);
  lines.push(`- ${dq.expenditureRowsFound > 0 ? "pass" : "FAIL"} Expenditure data: ${dq.expenditureRowsFound > 0 ? "present" : "missing"}`);
  lines.push(`- ${dq.communityProfilePopulated ? "pass" : "FAIL"} Community profile: ${dq.communityProfilePopulated ? "populated" : "empty"}`);
  lines.push(`- ${dq.capitalProjectsFound > 0 ? "pass" : "WARN"} Capital projects: ${dq.capitalProjectsFound > 0 ? "present" : "none found"}`);
  lines.push(`- ${dq.multiYearProjectionsYears > 0 ? "pass" : "WARN"} Multi-year projections: ${dq.multiYearProjectionsYears > 0 ? "present" : "none"}`);
  lines.push("");
  lines.push(hr);
  lines.push("");

  // Todos
  if (result.todos.length > 0) {
    lines.push(`## Todos Created (${result.todos.length})`);
    lines.push("");
    for (const todo of result.todos) {
      const icon = todo.priority === "high" ? "HIGH" : todo.priority === "medium" ? "MED" : "LOW";
      lines.push(`- [${icon}] **${todo.title}** — ${todo.category}${todo.sectionType ? ` (${todo.sectionType})` : ""}`);
    }
    lines.push("");
    lines.push(hr);
    lines.push("");
  }

  // Recommendations
  if (result.recommendations.length > 0) {
    lines.push("## Recommendations for Improvement");
    lines.push("");
    for (let i = 0; i < result.recommendations.length; i++) {
      lines.push(`${i + 1}. ${result.recommendations[i]}`);
    }
    lines.push("");
  }

  // Footer
  lines.push(hr);
  lines.push(`*Generated by Document Engine Eval System — ${result.timestamp}*`);

  return lines.join("\n");
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}
