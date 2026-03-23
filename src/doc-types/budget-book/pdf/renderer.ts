/**
 * Budget Book PDF Renderer.
 *
 * Renders a comprehensive municipal budget book using @react-pdf/renderer.
 * Supports embedded chart images, AI-generated narratives, and dynamic
 * styling from prior-year analysis.
 *
 * Extracted from src/core/budgetBookPdf.ts.
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { BudgetBookData } from "../data-types.js";
import type { StyleAnalysis } from "../../../core/types.js";
import { getColorsFromAnalysis, createBudgetBookStyles } from "./styles.js";

// ---- Types ----

interface SectionContent {
  sectionType: string;
  title: string;
  narrativeContent: string;
  tableData: Record<string, unknown>[];
  chartConfigs: Record<string, unknown>[];
}

// ---- Helpers ----

/**
 * Normalise a table cell value to a plain string.
 *
 * The AI sometimes returns cell values as objects (e.g. `{ content, isHeader, scope }`)
 * instead of plain strings, especially when accessibility skills are injected.
 * React error #31 ("Objects are not valid as a React child") occurs if these
 * reach the renderer un-coerced.
 */
function normalizeCell(cell: unknown): string {
  if (cell == null) return "";
  if (typeof cell === "string") return cell;
  if (typeof cell === "number" || typeof cell === "boolean") return String(cell);
  if (typeof cell === "object") {
    // Common AI output shapes: { content: "..." } or { value: "..." } or { text: "..." }
    const obj = cell as Record<string, unknown>;
    for (const key of ["content", "value", "text", "label"]) {
      if (typeof obj[key] === "string") return obj[key] as string;
      if (typeof obj[key] === "number") return String(obj[key]);
    }
    // Last resort — join all string values
    const strings = Object.values(obj).filter((v) => typeof v === "string");
    if (strings.length > 0) return strings.join(" ");
  }
  return String(cell);
}

/**
 * Normalise an entire row's cells array, handling cases where the AI
 * returns the row itself as an unexpected shape.
 */
function normalizeRow(row: unknown): { header: boolean; cells: string[] } {
  if (row == null || typeof row !== "object") return { header: false, cells: [] };
  const r = row as Record<string, unknown>;
  const header = Boolean(r.header ?? r.isHeader ?? false);
  const rawCells = Array.isArray(r.cells)
    ? r.cells
    : Array.isArray(r.values)
      ? r.values
      : [];
  return { header, cells: rawCells.map(normalizeCell) };
}

/**
 * Split narrative text into paragraphs for rendering.
 */
function splitNarrative(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

// ---- Page Components ----

function PageFooter({
  pageLabel,
  styles,
}: {
  pageLabel: string;
  styles: ReturnType<typeof createBudgetBookStyles>;
}): React.ReactElement {
  return React.createElement(
    View,
    { style: styles.footer, fixed: true },
    React.createElement(Text, null, pageLabel),
    React.createElement(
      Text,
      null,
      `Generated ${new Date().toLocaleDateString("en-US")}`
    )
  );
}

function CoverPage({
  data,
  styles,
}: {
  data: BudgetBookData;
  styles: ReturnType<typeof createBudgetBookStyles>;
}): React.ReactElement {
  return React.createElement(
    Page,
    { size: "LETTER", style: styles.coverPage },
    React.createElement(
      View,
      {
        style: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        },
      },
      React.createElement(
        Text,
        { style: styles.coverTitle },
        data.communityProfile.name
      ),
      React.createElement(
        Text,
        { style: styles.coverTitle },
        "Annual Budget"
      ),
      React.createElement(View, { style: styles.coverLine }),
      React.createElement(
        Text,
        { style: styles.coverSubtitle },
        `Fiscal Year ${data.fiscalYear}`
      ),
      React.createElement(
        Text,
        { style: styles.coverDetail },
        "Comprehensive Budget Document"
      ),
      React.createElement(
        Text,
        { style: styles.coverDetail },
        `Prepared ${new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}`
      )
    )
  );
}

function TableOfContentsPage({
  sections,
  styles,
}: {
  sections: SectionContent[];
  styles: ReturnType<typeof createBudgetBookStyles>;
}): React.ReactElement {
  const contentSections = sections.filter(
    (s) => s.sectionType !== "cover" && s.sectionType !== "toc"
  );

  return React.createElement(
    Page,
    { size: "LETTER", style: styles.page },
    React.createElement(Text, { style: styles.sectionTitle }, "Table of Contents"),
    React.createElement(
      View,
      { style: { marginTop: 12 } },
      ...contentSections.map((section, i) =>
        React.createElement(
          View,
          { key: section.sectionType, style: styles.tocEntry },
          React.createElement(Text, { style: styles.tocTitle }, section.title),
          React.createElement(
            Text,
            { style: styles.tocPage },
            String(i + 3)
          )
        )
      )
    ),
    React.createElement(PageFooter, { pageLabel: "Table of Contents", styles })
  );
}

function SectionPage({
  section,
  chartImages,
  styles,
}: {
  section: SectionContent;
  chartImages: Buffer[];
  styles: ReturnType<typeof createBudgetBookStyles>;
}): React.ReactElement {
  const narrativeText =
    typeof section.narrativeContent === "string"
      ? section.narrativeContent
      : section.narrativeContent
        ? String(section.narrativeContent)
        : "";
  const paragraphs = splitNarrative(narrativeText);
  const tableRows = (section.tableData || []).map(normalizeRow);

  const elements: React.ReactElement[] = [];

  // Section title
  elements.push(
    React.createElement(
      Text,
      { key: "title", style: styles.sectionTitle },
      section.title
    )
  );

  // Narrative paragraphs
  paragraphs.forEach((p, i) => {
    elements.push(
      React.createElement(
        Text,
        { key: `narrative-${i}`, style: styles.narrative },
        p
      )
    );
  });

  // Table
  if (tableRows.length > 0) {
    const headerRow = tableRows.find((r) => r.header);
    const dataRows = tableRows.filter((r) => !r.header);
    const colCount = headerRow?.cells.length || dataRows[0]?.cells.length || 1;
    const colWidth = `${Math.floor(100 / colCount)}%`;

    const tableElements: React.ReactElement[] = [];

    if (headerRow) {
      tableElements.push(
        React.createElement(
          View,
          { key: "header", style: styles.tableHeaderRow },
          ...headerRow.cells.map((cell, ci) =>
            React.createElement(
              Text,
              {
                key: `h-${ci}`,
                style: {
                  ...styles.tableHeaderCell,
                  width: colWidth,
                  textAlign: ci > 0 ? ("right" as const) : ("left" as const),
                },
              },
              cell
            )
          )
        )
      );
    }

    dataRows.forEach((row, ri) => {
      tableElements.push(
        React.createElement(
          View,
          {
            key: `row-${ri}`,
            style: ri % 2 === 0 ? styles.tableRow : styles.tableRowAlt,
          },
          ...row.cells.map((cell, ci) =>
            React.createElement(
              Text,
              {
                key: `c-${ri}-${ci}`,
                style: {
                  ...(ci > 0 ? styles.tableCellRight : styles.tableCell),
                  width: colWidth,
                },
              },
              cell
            )
          )
        )
      );
    });

    elements.push(
      React.createElement(
        View,
        { key: "table", style: styles.table },
        ...tableElements
      )
    );
  }

  // Chart images
  chartImages.forEach((buf, ci) => {
    elements.push(
      React.createElement(
        View,
        { key: `chart-${ci}`, style: styles.chartContainer },
        React.createElement(Image, {
          src: { data: buf, format: "png" },
          style: { maxWidth: 480, maxHeight: 320 },
        }),
        React.createElement(
          Text,
          { style: styles.chartCaption },
          normalizeCell(
            section.chartConfigs[ci]
              ? (section.chartConfigs[ci] as Record<string, unknown>).title
              : ""
          )
        )
      )
    );
  });

  elements.push(
    React.createElement(PageFooter, {
      key: "footer",
      pageLabel: section.title,
      styles,
    })
  );

  return React.createElement(
    Page,
    { size: "LETTER", style: styles.page },
    ...elements
  );
}

// ---- Main Export ----

/**
 * Render the full budget book as a PDF buffer.
 */
export async function renderBudgetBookPdf(
  sections: SectionContent[],
  data: BudgetBookData,
  styleAnalysis: StyleAnalysis | null,
  chartImages: Map<string, Buffer[]>
): Promise<Buffer> {
  const colors = getColorsFromAnalysis(styleAnalysis);
  const styles = createBudgetBookStyles(colors);

  // Order sections: cover, toc, then content sections in order
  const contentSections = sections.filter(
    (s) => s.sectionType !== "cover" && s.sectionType !== "toc"
  );

  const pages: React.ReactElement[] = [];

  // Cover page
  pages.push(
    React.createElement(CoverPage, { key: "cover", data, styles })
  );

  // Table of contents
  pages.push(
    React.createElement(TableOfContentsPage, {
      key: "toc",
      sections,
      styles,
    })
  );

  // Content section pages
  for (const section of contentSections) {
    const sectionCharts = chartImages.get(section.sectionType) || [];
    pages.push(
      React.createElement(SectionPage, {
        key: section.sectionType,
        section,
        chartImages: sectionCharts,
        styles,
      })
    );
  }

  const doc = React.createElement(
    Document,
    {
      title: `${data.communityProfile.name} — Annual Budget FY${data.fiscalYear}`,
      author: "ClearGov",
      subject: "Comprehensive Budget Document",
      language: "en-US",
    },
    ...pages
  );

  const buffer = await renderToBuffer(doc);
  return Buffer.from(buffer);
}
