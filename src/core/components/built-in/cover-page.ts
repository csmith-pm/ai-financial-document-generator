/**
 * Cover Page component — renders the document title page.
 */

import React from "react";
import { z } from "zod";
import { Text, View, Page } from "@react-pdf/renderer";
import type { ComponentDefinition, ComponentStyles } from "../types.js";

export const coverPagePropsSchema = z.object({
  communityName: z.string(),
  documentTitle: z.string().optional().default("Annual Budget"),
  fiscalYear: z.number(),
  preparedDate: z.string().optional(),
});

export type CoverPageProps = z.infer<typeof coverPagePropsSchema>;

export const coverPageComponent: ComponentDefinition = {
  id: "cover-page",
  version: "1.0.0",
  name: "Cover Page",
  description: "Document title page with community name, fiscal year, and branding",
  category: "structural",
  propsSchema: coverPagePropsSchema,
  builtIn: true,

  renderHtml(props: unknown, styles: ComponentStyles) {
    const { communityName, documentTitle, fiscalYear, preparedDate } =
      coverPagePropsSchema.parse(props);
    const date = preparedDate || new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });

    return React.createElement("div", {
      "data-component": "cover-page",
      style: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 400,
        textAlign: "center" as const,
        padding: 40,
      },
    },
      React.createElement("h1", {
        style: { fontSize: 32, fontWeight: "bold", color: styles.colors.primary, marginBottom: 12 },
      }, communityName),
      React.createElement("h2", {
        style: { fontSize: 32, fontWeight: "bold", color: styles.colors.primary, marginBottom: 24 },
      }, documentTitle),
      React.createElement("div", {
        style: { width: 160, height: 3, backgroundColor: styles.colors.accent, margin: "24px auto" },
      }),
      React.createElement("h3", {
        style: { fontSize: 20, color: styles.colors.secondary, marginBottom: 8 },
      }, `Fiscal Year ${fiscalYear}`),
      React.createElement("p", {
        style: { fontSize: 12, color: styles.colors.muted, marginTop: 16 },
      }, "Comprehensive Budget Document"),
      React.createElement("p", {
        style: { fontSize: 12, color: styles.colors.muted },
      }, `Prepared ${date}`)
    );
  },

  renderPdf(props: unknown, styles: ComponentStyles) {
    const { communityName, documentTitle, fiscalYear, preparedDate } =
      coverPagePropsSchema.parse(props);
    const date = preparedDate || new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });

    return React.createElement(View, {
      style: { flex: 1, justifyContent: "center", alignItems: "center" },
    },
      React.createElement(Text, {
        style: { fontSize: 32, fontFamily: "Helvetica-Bold", color: styles.colors.primary, textAlign: "center", marginBottom: 12 },
      }, communityName),
      React.createElement(Text, {
        style: { fontSize: 32, fontFamily: "Helvetica-Bold", color: styles.colors.primary, textAlign: "center", marginBottom: 12 },
      }, documentTitle),
      React.createElement(View, {
        style: { width: 160, height: 3, backgroundColor: styles.colors.accent, marginTop: 24, marginBottom: 24 },
      }),
      React.createElement(Text, {
        style: { fontSize: 20, color: styles.colors.secondary, textAlign: "center", marginBottom: 8 },
      }, `Fiscal Year ${fiscalYear}`),
      React.createElement(Text, {
        style: { fontSize: 12, color: styles.colors.muted, textAlign: "center", marginTop: 16 },
      }, "Comprehensive Budget Document"),
      React.createElement(Text, {
        style: { fontSize: 12, color: styles.colors.muted, textAlign: "center" },
      }, `Prepared ${date}`)
    );
  },
};
