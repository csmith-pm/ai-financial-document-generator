/**
 * Table of Contents component — renders a list of section titles with page numbers.
 */

import React from "react";
import { z } from "zod";
import { Text, View } from "@react-pdf/renderer";
import type { ComponentDefinition, ComponentStyles } from "../types.js";

export const tocPropsSchema = z.object({
  entries: z.array(z.object({
    title: z.string(),
    page: z.number(),
  })),
});

export type TocProps = z.infer<typeof tocPropsSchema>;

export const tocComponent: ComponentDefinition = {
  id: "toc",
  version: "1.0.0",
  name: "Table of Contents",
  description: "Section listing with page numbers",
  category: "structural",
  propsSchema: tocPropsSchema,
  builtIn: true,

  renderHtml(props: unknown, styles: ComponentStyles) {
    const { entries } = tocPropsSchema.parse(props);
    return React.createElement("div", { "data-component": "toc" },
      React.createElement("h2", {
        style: {
          fontSize: 18,
          fontWeight: "bold",
          color: styles.colors.primary,
          marginBottom: 12,
          paddingBottom: 6,
          borderBottom: `2px solid ${styles.colors.accent}`,
        },
      }, "Table of Contents"),
      React.createElement("div", { style: { marginTop: 12 } },
        ...entries.map((entry, i) =>
          React.createElement("div", {
            key: i,
            style: {
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 0",
              borderBottom: `1px solid ${styles.colors.borderColor}`,
            },
          },
            React.createElement("span", { style: { fontSize: 12, color: styles.colors.text } }, entry.title),
            React.createElement("span", { style: { fontSize: 12, color: styles.colors.muted } }, String(entry.page))
          )
        )
      )
    );
  },

  renderPdf(props: unknown, styles: ComponentStyles) {
    const { entries } = tocPropsSchema.parse(props);
    return React.createElement(View, null,
      React.createElement(Text, {
        style: {
          fontSize: 18,
          fontFamily: "Helvetica-Bold",
          color: styles.colors.primary,
          marginBottom: 12,
          paddingBottom: 6,
          borderBottomWidth: 2,
          borderBottomColor: styles.colors.accent,
        },
      }, "Table of Contents"),
      React.createElement(View, { style: { marginTop: 12 } },
        ...entries.map((entry, i) =>
          React.createElement(View, {
            key: i,
            style: {
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: 6,
              borderBottomWidth: 1,
              borderBottomColor: styles.colors.borderColor,
            },
          },
            React.createElement(Text, { style: { fontSize: 12, color: styles.colors.text } }, entry.title),
            React.createElement(Text, { style: { fontSize: 12, color: styles.colors.muted } }, String(entry.page))
          )
        )
      )
    );
  },
};
