/**
 * Narrative Block component — renders paragraphs of text.
 */

import React from "react";
import { z } from "zod";
import { Text, View } from "@react-pdf/renderer";
import type { ComponentDefinition, ComponentStyles } from "../types.js";

export const narrativeBlockPropsSchema = z.object({
  text: z.string().describe("Narrative text, split into paragraphs on double newlines"),
});

export type NarrativeBlockProps = z.infer<typeof narrativeBlockPropsSchema>;

function splitParagraphs(text: string): string[] {
  return text.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 0);
}

export const narrativeBlockComponent: ComponentDefinition = {
  id: "narrative-block",
  version: "1.0.0",
  name: "Narrative Block",
  description: "Renders paragraphs of narrative text with proper spacing",
  category: "narrative",
  propsSchema: narrativeBlockPropsSchema,
  builtIn: true,

  renderHtml(props: unknown, styles: ComponentStyles) {
    const { text } = narrativeBlockPropsSchema.parse(props);
    const paragraphs = splitParagraphs(text);
    return React.createElement(
      "div",
      { "data-component": "narrative-block", style: { marginBottom: styles.spacing.paragraphGap } },
      ...paragraphs.map((p, i) =>
        React.createElement("p", {
          key: i,
          style: {
            fontFamily: styles.typography.bodyFont,
            fontSize: styles.typography.bodySize,
            lineHeight: 1.6,
            color: styles.colors.text,
            marginBottom: styles.spacing.paragraphGap,
          },
        }, p)
      )
    );
  },

  renderPdf(props: unknown, styles: ComponentStyles) {
    const { text } = narrativeBlockPropsSchema.parse(props);
    const paragraphs = splitParagraphs(text);
    return React.createElement(
      View,
      { style: { marginBottom: 12 } },
      ...paragraphs.map((p, i) =>
        React.createElement(Text, {
          key: i,
          style: {
            fontSize: 10,
            lineHeight: 1.6,
            marginBottom: 12,
            color: styles.colors.text,
          },
        }, p)
      )
    );
  },
};
