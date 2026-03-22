/**
 * Prior-Year PDF Analyzer.
 *
 * Extracts style, tone, format, chart types, and layout information
 * from a user-uploaded prior-year budget book PDF using the AI provider's
 * multimodal (vision) capabilities.
 *
 * Extracted from src/core/pdfAnalyzer.ts.
 */

import type { AiProvider, StorageProvider } from "../../../core/providers.js";
import type { StyleAnalysis } from "../../../core/types.js";

/**
 * Convert PDF pages to image buffers for vision analysis.
 * Uses pdf-to-img if available, falls back to a simplified approach.
 */
async function pdfToImages(pdfBuffer: Buffer): Promise<Buffer[]> {
  try {
    const { pdf } = await import("pdf-to-img");
    const images: Buffer[] = [];
    // Sample pages: cover, TOC, first content, revenue, expense, charts, appendix
    const document = await pdf(pdfBuffer, { scale: 1.5 });
    let pageNum = 0;
    const maxPages = 15; // Analyze up to 15 representative pages
    for await (const page of document) {
      if (pageNum >= maxPages) break;
      images.push(Buffer.from(page));
      pageNum++;
    }
    return images;
  } catch {
    // If pdf-to-img is not available, return empty (text-only analysis)
    return [];
  }
}

/**
 * Analyze a prior-year budget book PDF for style, tone, and format.
 */
export async function analyzePriorYearPdf(
  ai: AiProvider,
  storage: StorageProvider,
  tenantId: string,
  s3Key: string
): Promise<StyleAnalysis> {
  const pdfBuffer = await storage.getObject(s3Key);
  const images = await pdfToImages(pdfBuffer);

  const systemPrompt = `You are a document design analyst specializing in municipal budget books. Analyze the provided budget book pages and extract detailed style information. Respond with JSON only.

Your analysis must include:
1. Color scheme (primary, secondary, accent, header background, text colors as hex)
2. Typography (heading style description, body style description, estimated body font size)
3. Layout (column count, margin notes, header/footer style, page number placement)
4. Chart types used (list all: bar, pie, line, stacked bar, etc.)
5. Narrative tone (formal/conversational/technical/mixed)
6. Section order (list sections in order they appear)
7. Branding elements (logos, watermarks, decorative borders, color bars)
8. Overall style description (one sentence)

Response format:
{
  "colorScheme": { "primary": "#hex", "secondary": "#hex", "accent": "#hex", "headerBackground": "#hex", "textColor": "#hex" },
  "typography": { "headingStyle": "description", "bodyStyle": "description", "estimatedBodySize": 10 },
  "layout": { "columnCount": 1, "hasMarginNotes": false, "headerFooterStyle": "description", "pageNumberPlacement": "bottom-center" },
  "chartTypes": ["bar", "pie"],
  "narrativeTone": "formal",
  "sectionOrder": ["Cover", "Table of Contents", "Executive Summary", ...],
  "brandingElements": ["city seal", "blue header bar"],
  "overallStyle": "Professional, clean layout with blue accent colors and serif headings"
}`;

  if (images.length > 0) {
    // Use vision analysis with page images
    const selectedImages = selectRepresentativePages(images);

    const visionResult = await ai.callVision(
      systemPrompt,
      selectedImages,
      { model: "claude-sonnet-4-20250514", maxTokens: 4096, temperature: 0.2 },
    );

    await ai.logUsage?.(
      tenantId, "analyzePriorYearPdf",
      visionResult.inputTokens, visionResult.outputTokens,
      "claude-sonnet-4-20250514"
    );

    return parseStyleAnalysis(visionResult.text);
  }

  // Fallback: text-only analysis (no images extracted)
  const result = await ai.callJson<StyleAnalysis>(
    systemPrompt,
    "I cannot provide page images. Please provide a default professional municipal budget book style analysis.",
    { maxTokens: 2048, temperature: 0.2 }
  );

  await ai.logUsage?.(
    tenantId, "analyzePriorYearPdf",
    result.inputTokens, result.outputTokens, result.model
  );

  return result.data;
}

/**
 * Select representative pages from the full set.
 * Takes cover (first), early pages, middle, and late pages.
 */
function selectRepresentativePages(images: Buffer[]): Buffer[] {
  if (images.length <= 8) return images;

  const indices = new Set<number>();
  indices.add(0); // Cover
  indices.add(1); // TOC typically
  indices.add(2); // First content page

  // Middle pages
  const mid = Math.floor(images.length / 2);
  indices.add(mid - 1);
  indices.add(mid);
  indices.add(mid + 1);

  // Later pages (charts/appendix often here)
  indices.add(images.length - 3);
  indices.add(images.length - 1);

  return [...indices]
    .filter((i) => i >= 0 && i < images.length)
    .sort((a, b) => a - b)
    .map((i) => images[i] as Buffer);
}

/**
 * Parse style analysis from AI's JSON response.
 */
function parseStyleAnalysis(text: string): StyleAnalysis {
  let jsonStr = text.trim();
  const jsonMatch = /```(?:json)?\s*([\s\S]*?)```/.exec(jsonStr);
  if (jsonMatch?.[1]) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    return JSON.parse(jsonStr) as StyleAnalysis;
  } catch {
    // Return sensible defaults
    return {
      colorScheme: {
        primary: "#1a365d",
        secondary: "#2d4a7a",
        accent: "#3182ce",
        headerBackground: "#e2e8f0",
        textColor: "#1a202c",
      },
      typography: {
        headingStyle: "Bold sans-serif",
        bodyStyle: "Regular serif",
        estimatedBodySize: 10,
      },
      layout: {
        columnCount: 1,
        hasMarginNotes: false,
        headerFooterStyle: "Simple with page numbers",
        pageNumberPlacement: "bottom-center",
      },
      chartTypes: ["bar", "pie", "line"],
      narrativeTone: "formal",
      sectionOrder: [
        "Cover", "Table of Contents", "Executive Summary",
        "Revenue", "Expenditure", "Personnel", "Capital",
        "Multi-Year Outlook", "Appendix",
      ],
      brandingElements: [],
      overallStyle: "Professional municipal budget document with blue accents",
    };
  }
}
