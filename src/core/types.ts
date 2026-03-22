/**
 * Shared types used across multiple core modules.
 */

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
