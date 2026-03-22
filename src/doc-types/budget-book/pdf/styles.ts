/**
 * Dynamic PDF styles for Budget Book.
 *
 * Generates a StyleSheet from a prior-year style analysis,
 * falling back to ClearGov defaults.
 *
 * Extracted from src/core/pdfStyles.ts.
 */

import { StyleSheet } from "@react-pdf/renderer";
import type { StyleAnalysis } from "../../../core/types.js";

export interface BudgetBookColors {
  primary: string;
  secondary: string;
  accent: string;
  headerBg: string;
  borderColor: string;
  lightBg: string;
  text: string;
  muted: string;
  white: string;
}

const DEFAULT_COLORS: BudgetBookColors = {
  primary: "#1a365d",
  secondary: "#2d4a7a",
  accent: "#3182ce",
  headerBg: "#e2e8f0",
  borderColor: "#cbd5e0",
  lightBg: "#f7fafc",
  text: "#1a202c",
  muted: "#718096",
  white: "#ffffff",
};

export function getColorsFromAnalysis(
  analysis: StyleAnalysis | null
): BudgetBookColors {
  if (!analysis) return DEFAULT_COLORS;

  return {
    primary: analysis.colorScheme.primary || DEFAULT_COLORS.primary,
    secondary: analysis.colorScheme.secondary || DEFAULT_COLORS.secondary,
    accent: analysis.colorScheme.accent || DEFAULT_COLORS.accent,
    headerBg: analysis.colorScheme.headerBackground || DEFAULT_COLORS.headerBg,
    borderColor: DEFAULT_COLORS.borderColor,
    lightBg: DEFAULT_COLORS.lightBg,
    text: analysis.colorScheme.textColor || DEFAULT_COLORS.text,
    muted: DEFAULT_COLORS.muted,
    white: DEFAULT_COLORS.white,
  };
}

export function createBudgetBookStyles(c: BudgetBookColors) {
  return StyleSheet.create({
    page: {
      padding: 40,
      fontFamily: "Helvetica",
      fontSize: 10,
      color: c.text,
    },
    coverPage: {
      padding: 40,
      fontFamily: "Helvetica",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
    },
    coverTitle: {
      fontSize: 32,
      fontFamily: "Helvetica-Bold",
      color: c.primary,
      textAlign: "center",
      marginBottom: 12,
    },
    coverSubtitle: {
      fontSize: 20,
      color: c.secondary,
      textAlign: "center",
      marginBottom: 8,
    },
    coverDetail: {
      fontSize: 12,
      color: c.muted,
      textAlign: "center",
      marginTop: 16,
    },
    coverLine: {
      width: 160,
      height: 3,
      backgroundColor: c.accent,
      marginTop: 24,
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontFamily: "Helvetica-Bold",
      color: c.primary,
      marginBottom: 12,
      paddingBottom: 6,
      borderBottomWidth: 2,
      borderBottomColor: c.accent,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: c.muted,
      marginBottom: 12,
    },
    narrative: {
      fontSize: 10,
      lineHeight: 1.6,
      marginBottom: 12,
      color: c.text,
    },
    table: {
      width: "100%",
      marginBottom: 16,
    },
    tableHeaderRow: {
      flexDirection: "row",
      backgroundColor: c.primary,
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    tableHeaderCell: {
      color: c.white,
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
      paddingHorizontal: 4,
    },
    tableRow: {
      flexDirection: "row",
      paddingVertical: 5,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: c.borderColor,
    },
    tableRowAlt: {
      flexDirection: "row",
      paddingVertical: 5,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: c.borderColor,
      backgroundColor: c.lightBg,
    },
    tableCell: {
      fontSize: 9,
      paddingHorizontal: 4,
    },
    tableCellRight: {
      fontSize: 9,
      paddingHorizontal: 4,
      textAlign: "right",
    },
    totalRow: {
      flexDirection: "row",
      paddingVertical: 6,
      paddingHorizontal: 4,
      borderTopWidth: 2,
      borderTopColor: c.primary,
      backgroundColor: c.headerBg,
    },
    totalCell: {
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
      paddingHorizontal: 4,
    },
    totalCellRight: {
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
      paddingHorizontal: 4,
      textAlign: "right",
    },
    statGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginBottom: 16,
    },
    statCard: {
      width: "45%",
      padding: 12,
      borderWidth: 1,
      borderColor: c.borderColor,
      borderRadius: 4,
      backgroundColor: c.lightBg,
    },
    statLabel: {
      fontSize: 9,
      color: c.muted,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 16,
      fontFamily: "Helvetica-Bold",
      color: c.primary,
    },
    chartContainer: {
      marginBottom: 16,
      alignItems: "center",
    },
    chartCaption: {
      fontSize: 8,
      color: c.muted,
      textAlign: "center",
      marginTop: 4,
    },
    tocEntry: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: c.borderColor,
    },
    tocTitle: {
      fontSize: 12,
      color: c.text,
    },
    tocPage: {
      fontSize: 12,
      color: c.muted,
    },
    footer: {
      position: "absolute",
      bottom: 20,
      left: 40,
      right: 40,
      flexDirection: "row",
      justifyContent: "space-between",
      fontSize: 8,
      color: c.muted,
    },
  });
}
