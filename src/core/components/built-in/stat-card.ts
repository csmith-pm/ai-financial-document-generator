/**
 * Stat Card component — renders a key metric with label, value, and optional trend.
 */

import React from "react";
import { z } from "zod";
import { Text, View } from "@react-pdf/renderer";
import type { ComponentDefinition, ComponentStyles } from "../types.js";

export const statCardPropsSchema = z.object({
  label: z.string(),
  value: z.string(),
  trend: z.string().optional(),
});

export type StatCardProps = z.infer<typeof statCardPropsSchema>;

export const statCardComponent: ComponentDefinition = {
  id: "stat-card",
  version: "1.0.0",
  name: "Stat Card",
  description: "Key metric display with label, value, and optional trend indicator",
  category: "stat",
  propsSchema: statCardPropsSchema,
  builtIn: true,

  renderHtml(props: unknown, styles: ComponentStyles) {
    const { label, value, trend } = statCardPropsSchema.parse(props);
    return React.createElement("div", {
      "data-component": "stat-card",
      style: {
        display: "inline-block",
        width: "45%",
        padding: 12,
        border: `1px solid ${styles.colors.borderColor}`,
        borderRadius: 4,
        backgroundColor: styles.colors.lightBg,
        marginRight: 12,
        marginBottom: 12,
      },
    },
      React.createElement("div", {
        style: { fontSize: 9, color: styles.colors.muted, marginBottom: 4 },
      }, label),
      React.createElement("div", {
        style: { fontSize: 16, fontWeight: "bold", color: styles.colors.primary },
      }, value),
      trend ? React.createElement("div", {
        style: { fontSize: 9, color: styles.colors.accent, marginTop: 4 },
      }, trend) : null
    );
  },

  renderPdf(props: unknown, styles: ComponentStyles) {
    const { label, value, trend } = statCardPropsSchema.parse(props);
    return React.createElement(View, {
      style: {
        width: "45%",
        padding: 12,
        borderWidth: 1,
        borderColor: styles.colors.borderColor,
        borderRadius: 4,
        backgroundColor: styles.colors.lightBg,
      },
    },
      React.createElement(Text, {
        style: { fontSize: 9, color: styles.colors.muted, marginBottom: 4 },
      }, label),
      React.createElement(Text, {
        style: { fontSize: 16, fontFamily: "Helvetica-Bold", color: styles.colors.primary },
      }, value),
      trend ? React.createElement(Text, {
        style: { fontSize: 9, color: styles.colors.accent, marginTop: 4 },
      }, trend) : null
    );
  },
};
