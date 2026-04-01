/**
 * Shared types used across multiple core modules.
 */

// ─── Prior Document Analysis ────────────────────────────────────────────────

/**
 * Structured index of a prior document's table of contents and sections.
 * Produced by the index-prior-document pipeline step.
 */
export interface DocumentIndex {
  title: string;
  sections: Array<{
    /** Section name as it appears in the document, e.g. "About Bristol" */
    name: string;
    startPage: number;
    endPage: number;
    /** Maps to one of the doc type's sectionType IDs, or null if unmapped */
    mappedSectionType: string | null;
    hasNarrative: boolean;
    hasTables: boolean;
    hasCharts: boolean;
  }>;
  /** Doc-type-specific metadata extracted during indexing (community profile, org info, etc.) */
  metadata: Record<string, unknown>;
}

/**
 * Extracted content from a single section of the prior document.
 * Produced by the extract-prior-content pipeline step.
 */
export interface PriorSectionContent {
  sectionType: string;
  /** Full narrative prose from the prior year */
  narrative: string;
  tables: Array<{
    title: string;
    headers: string[];
    rows: string[][];
  }>;
  chartDescriptions: Array<{
    type: string;
    title: string;
    description: string;
  }>;
  pageCount: number;
  /** Key narrative points / findings from the prior year */
  keyFindings: string[];
}

// ─── Style Analysis ─────────────────────────────────────────────────────────

export interface StyleAnalysis {
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
    headerBackground: string;
    textColor: string;
  };
  typography: {
    headingStyle: string;
    bodyStyle: string;
    estimatedBodySize: number;
  };
  layout: {
    columnCount: number;
    hasMarginNotes: boolean;
    headerFooterStyle: string;
    pageNumberPlacement: string;
  };
  chartTypes: string[];
  narrativeTone: string;
  sectionOrder: string[];
  brandingElements: string[];
  overallStyle: string;
}
