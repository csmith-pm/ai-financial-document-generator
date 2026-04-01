/**
 * Evaluation system types.
 */

export interface EvalManifest {
  name: string;
  description: string;
  docType: string;
  fiscalYear: number;
  tenantId: string;
  dataFiles: string[];
  priorDocumentPdf: string;
  expectations: {
    minPageCount: number;
    maxPageCount: number;
    expectedSections: number;
    minGfoaScore: number;
    minAdaScore: number;
    requiredSections: string[];
    requiredDataPresent: string[];
  };
}

export interface StepResult {
  stepId: string;
  stepName: string;
  status: string;
  duration: number;
  message: string;
  error?: string;
}

export interface GfoaCategory {
  name: string;
  score: number;
  maxScore: number;
  feedback: string;
}

export interface EvalResult {
  testName: string;
  description: string;
  timestamp: string;
  duration: number;

  pipelineStatus: "completed" | "completed_with_todos" | "failed";
  stepResults: StepResult[];

  documentAnalysis: {
    totalSections: number;
    sectionsWithNarrative: number;
    sectionsWithTables: number;
    sectionsWithCharts: number;
    totalNarrativeLength: number;
    priorPdfSections: number;
  };

  gfoaReview: {
    passed: boolean;
    score: number;
    maxScore: number;
    categories: GfoaCategory[];
    recommendations: string[];
  } | null;

  adaReview: {
    passed: boolean;
    score: number;
    issues: string[];
  } | null;

  dataQuality: {
    revenueRowsFound: number;
    expenditureRowsFound: number;
    totalRevenue: number;
    totalExpenditure: number;
    communityProfilePopulated: boolean;
    capitalProjectsFound: number;
    multiYearProjectionsYears: number;
  };

  todos: Array<{
    category: string;
    title: string;
    priority: string;
    status: string;
    sectionType: string | null;
  }>;

  comparison: {
    priorSectionCount: number;
    generatedSectionCount: number;
    sectionCoveragePercent: number;
    priorEstimatedPages: number;
    generatedEstimatedPages: number;
    pageLengthRatio: number;
  };

  overallScore: number;
  grade: string;
  recommendations: string[];
}
