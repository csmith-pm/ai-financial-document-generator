/**
 * Financial Table component — renders data tables with header detection,
 * alternating row colors, and right-aligned numeric columns.
 */

import React from "react";
import { z } from "zod";
import { Text, View } from "@react-pdf/renderer";
import type { ComponentDefinition, ComponentStyles } from "../types.js";

const tableCellSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
  .transform((v) => (v == null ? "" : String(v)));

const tableRowSchema = z.object({
  header: z.boolean().optional().default(false),
  cells: z.array(z.unknown().transform((v) => {
    if (v == null) return "";
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "object") {
      const obj = v as Record<string, unknown>;
      for (const key of ["content", "value", "text", "label"]) {
        if (typeof obj[key] === "string") return obj[key] as string;
        if (typeof obj[key] === "number") return String(obj[key]);
      }
    }
    return String(v);
  })),
});

export const financialTablePropsSchema = z.object({
  rows: z.array(tableRowSchema),
  caption: z.string().optional(),
});

export type FinancialTableProps = z.infer<typeof financialTablePropsSchema>;

export const financialTableComponent: ComponentDefinition = {
  id: "financial-table",
  version: "1.0.0",
  name: "Financial Table",
  description: "Data table with header row, alternating colors, and right-aligned numbers",
  category: "table",
  propsSchema: financialTablePropsSchema,
  builtIn: true,

  renderHtml(props: unknown, styles: ComponentStyles) {
    const { rows, caption } = financialTablePropsSchema.parse(props);
    const headerRow = rows.find((r) => r.header);
    const dataRows = rows.filter((r) => !r.header);

    const elements: React.ReactElement[] = [];

    if (headerRow) {
      elements.push(
        React.createElement("thead", { key: "head" },
          React.createElement("tr", {
            style: { backgroundColor: styles.colors.primary },
          },
            ...headerRow.cells.map((cell, ci) =>
              React.createElement("th", {
                key: ci,
                style: {
                  color: styles.colors.white,
                  fontSize: 9,
                  fontWeight: "bold",
                  padding: "6px 8px",
                  textAlign: ci > 0 ? "right" as const : "left" as const,
                },
              }, cell)
            )
          )
        )
      );
    }

    elements.push(
      React.createElement("tbody", { key: "body" },
        ...dataRows.map((row, ri) =>
          React.createElement("tr", {
            key: ri,
            style: {
              backgroundColor: ri % 2 === 0 ? styles.colors.lightBg : styles.colors.white,
              borderBottom: `1px solid ${styles.colors.borderColor}`,
            },
          },
            ...row.cells.map((cell, ci) =>
              React.createElement("td", {
                key: ci,
                style: {
                  fontSize: 9,
                  padding: "5px 8px",
                  textAlign: ci > 0 ? "right" as const : "left" as const,
                },
              }, cell)
            )
          )
        )
      )
    );

    const tableEl = React.createElement("table", {
      "data-component": "financial-table",
      style: { width: "100%", borderCollapse: "collapse", marginBottom: 16 },
    }, ...elements);

    if (caption) {
      return React.createElement("div", null,
        tableEl,
        React.createElement("p", {
          style: { fontSize: 8, color: styles.colors.muted, textAlign: "center", marginTop: 4 },
        }, caption)
      );
    }

    return tableEl;
  },

  renderPdf(props: unknown, styles: ComponentStyles) {
    const { rows } = financialTablePropsSchema.parse(props);
    const headerRow = rows.find((r) => r.header);
    const dataRows = rows.filter((r) => !r.header);
    const colCount = headerRow?.cells.length || dataRows[0]?.cells.length || 1;
    const colWidth = `${Math.floor(100 / colCount)}%`;

    const tableElements: React.ReactElement[] = [];

    if (headerRow) {
      tableElements.push(
        React.createElement(View, {
          key: "header",
          style: {
            flexDirection: "row",
            backgroundColor: styles.colors.primary,
            paddingVertical: 6,
            paddingHorizontal: 4,
          },
        },
          ...headerRow.cells.map((cell, ci) =>
            React.createElement(Text, {
              key: ci,
              style: {
                color: styles.colors.white,
                fontSize: 9,
                fontFamily: "Helvetica-Bold",
                paddingHorizontal: 4,
                width: colWidth,
                textAlign: ci > 0 ? "right" as const : "left" as const,
              },
            }, cell)
          )
        )
      );
    }

    dataRows.forEach((row, ri) => {
      tableElements.push(
        React.createElement(View, {
          key: `row-${ri}`,
          style: {
            flexDirection: "row",
            paddingVertical: 5,
            paddingHorizontal: 4,
            borderBottomWidth: 1,
            borderBottomColor: styles.colors.borderColor,
            backgroundColor: ri % 2 === 0 ? undefined : styles.colors.lightBg,
          },
        },
          ...row.cells.map((cell, ci) =>
            React.createElement(Text, {
              key: ci,
              style: {
                fontSize: 9,
                paddingHorizontal: 4,
                width: colWidth,
                textAlign: ci > 0 ? "right" as const : "left" as const,
              },
            }, cell)
          )
        )
      );
    });

    return React.createElement(View, {
      style: { width: "100%", marginBottom: 16 },
    }, ...tableElements);
  },
};
