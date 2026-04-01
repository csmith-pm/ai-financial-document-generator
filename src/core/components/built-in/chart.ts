/**
 * Chart components — bar, pie, line, stacked-bar, grouped-bar.
 *
 * PDF: Renders a pre-rendered PNG image with caption.
 * HTML: Renders a placeholder with chart metadata (Recharts integration
 * will be added when the UI component library is built).
 */

import React from "react";
import { z } from "zod";
import { Text, View, Image } from "@react-pdf/renderer";
import type { ComponentDefinition, ComponentStyles } from "../types.js";

const chartPropsSchema = z.object({
  title: z.string(),
  chartType: z.enum(["bar", "pie", "line", "stacked-bar", "grouped-bar"]),
  data: z.array(z.record(z.unknown())),
  dataKeys: z.array(z.string()),
  categoryKey: z.string(),
  width: z.number().optional().default(800),
  height: z.number().optional().default(400),
  colors: z.array(z.string()).optional(),
  xAxisLabel: z.string().optional(),
  yAxisLabel: z.string().optional(),
  /** Pre-rendered PNG image buffer (for PDF rendering) */
  imageBuffer: z.any().optional(),
});

export type ChartProps = z.infer<typeof chartPropsSchema>;

function makeChartComponent(
  id: string,
  chartType: string,
  name: string
): ComponentDefinition {
  return {
    id,
    version: "1.0.0",
    name,
    description: `${name} visualization with data labels and legend`,
    category: "chart",
    propsSchema: chartPropsSchema,
    builtIn: true,

    renderHtml(props: unknown, styles: ComponentStyles) {
      const parsed = chartPropsSchema.parse(props);
      return React.createElement("div", {
        "data-component": id,
        style: {
          marginBottom: 16,
          textAlign: "center" as const,
          border: `1px solid ${styles.colors.borderColor}`,
          borderRadius: 4,
          padding: 16,
          backgroundColor: styles.colors.lightBg,
        },
      },
        React.createElement("div", {
          style: {
            fontSize: 12,
            fontWeight: "bold",
            color: styles.colors.primary,
            marginBottom: 8,
          },
        }, parsed.title),
        React.createElement("div", {
          style: { fontSize: 10, color: styles.colors.muted },
        }, `${name} — ${parsed.data.length} data points, keys: ${parsed.dataKeys.join(", ")}`),
        // Placeholder — Recharts integration added in Phase 4
        React.createElement("div", {
          style: {
            width: Math.min(parsed.width, 600),
            height: Math.min(parsed.height, 300),
            margin: "12px auto",
            backgroundColor: styles.colors.white,
            border: `1px dashed ${styles.colors.borderColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            color: styles.colors.muted,
          },
        }, `[${name} visualization]`)
      );
    },

    renderPdf(props: unknown, styles: ComponentStyles) {
      const parsed = chartPropsSchema.parse(props);

      const elements: React.ReactElement[] = [];

      if (parsed.imageBuffer) {
        elements.push(
          React.createElement(Image, {
            key: "img",
            src: { data: parsed.imageBuffer as Buffer, format: "png" },
            style: { maxWidth: 480, maxHeight: 320 },
          })
        );
      }

      elements.push(
        React.createElement(Text, {
          key: "caption",
          style: {
            fontSize: 8,
            color: styles.colors.muted,
            textAlign: "center",
            marginTop: 4,
          },
        }, parsed.title)
      );

      return React.createElement(View, {
        style: { marginBottom: 16, alignItems: "center" },
      }, ...elements);
    },
  };
}

export const barChartComponent = makeChartComponent("bar-chart", "bar", "Bar Chart");
export const pieChartComponent = makeChartComponent("pie-chart", "pie", "Pie Chart");
export const lineChartComponent = makeChartComponent("line-chart", "line", "Line Chart");
export const stackedBarChartComponent = makeChartComponent("stacked-bar-chart", "stacked-bar", "Stacked Bar Chart");
export const groupedBarChartComponent = makeChartComponent("grouped-bar-chart", "grouped-bar", "Grouped Bar Chart");
