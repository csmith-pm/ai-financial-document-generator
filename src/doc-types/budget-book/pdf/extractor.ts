/**
 * Prior-Year Budget Book Content Extractor.
 *
 * For each section in the DocumentIndex, reads the corresponding pages from
 * the prior PDF via vision API and extracts narrative, tables, and chart
 * descriptions. Runs sections in parallel for speed.
 */

import type { AiProvider, StorageProvider } from "../../../core/providers.js";
import type { DocumentIndex, PriorSectionContent } from "../../../core/types.js";

const EXTRACTOR_PROMPT = `You are a municipal finance document reader. You will receive page images from a specific section of a prior-year budget book.

Extract the content from these pages:

1. **narrative**: All prose/narrative text, preserving paragraph structure. Include introductory context, analysis, and any policy descriptions.
2. **tables**: All data tables with their titles, headers, and row data. Preserve the structure.
3. **chartDescriptions**: Describe each chart/graph — its type, title, and what data it shows.
4. **keyFindings**: List the 3-5 most important narrative points, findings, or policy statements from this section.

Respond with valid JSON:
{
  "sectionType": "the_section_type",
  "narrative": "Full narrative text from this section, preserving paragraphs...",
  "tables": [
    {
      "title": "Table Title",
      "headers": ["Column1", "Column2", "Column3"],
      "rows": [["row1col1", "row1col2", "row1col3"]]
    }
  ],
  "chartDescriptions": [
    {
      "type": "bar",
      "title": "Revenue by Source",
      "description": "Horizontal bar chart showing revenue broken down by property tax, sales tax, etc."
    }
  ],
  "pageCount": 3,
  "keyFindings": [
    "General Fund revenue increased 4.2% year-over-year",
    "Property tax remains the largest revenue source at 52%"
  ]
}

Rules:
- Extract ALL narrative text — don't summarize, preserve the full prose
- For tables, capture actual data values where legible
- Estimate values if exact numbers aren't clear from the image
- If a page is mostly charts/graphics with little text, still describe what you see`;

/**
 * Extract specific page range from a PDF as image buffers.
 */
async function extractPageRange(
  pdfBuffer: Buffer,
  startPage: number,
  endPage: number,
  maxPages: number = 8
): Promise<Buffer[]> {
  try {
    const { pdf } = await import("pdf-to-img");
    const images: Buffer[] = [];
    const document = await pdf(pdfBuffer, { scale: 1.5 });
    let pageNum = 0;

    for await (const page of document) {
      if (pageNum >= startPage && pageNum <= endPage && images.length < maxPages) {
        images.push(Buffer.from(page));
      }
      pageNum++;
      if (pageNum > endPage) break;
    }
    return images;
  } catch {
    return [];
  }
}

/**
 * Extract content from a single section of the prior PDF.
 */
async function extractSection(
  ai: AiProvider,
  pdfBuffer: Buffer,
  sectionName: string,
  sectionType: string,
  startPage: number,
  endPage: number,
  tenantId: string,
): Promise<PriorSectionContent> {
  const images = await extractPageRange(pdfBuffer, startPage, endPage);

  if (images.length === 0) {
    return {
      sectionType,
      narrative: "",
      tables: [],
      chartDescriptions: [],
      pageCount: 0,
      keyFindings: [],
    };
  }

  const prompt = `${EXTRACTOR_PROMPT}\n\nSection: "${sectionName}" (mapped type: "${sectionType}")`;

  const result = await ai.callVision(
    prompt,
    images,
    { model: "claude-sonnet-4-20250514", maxTokens: 8192, temperature: 0.1 },
  );

  await ai.logUsage?.(
    tenantId, `extractSection_${sectionType}`,
    result.inputTokens, result.outputTokens, "claude-sonnet-4-20250514"
  );

  return parseExtractionResult(result.text, sectionType);
}

function parseExtractionResult(text: string, sectionType: string): PriorSectionContent {
  let jsonStr = text.trim();
  const jsonMatch = /```(?:json)?\s*([\s\S]*?)```/.exec(jsonStr);
  if (jsonMatch?.[1]) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr) as PriorSectionContent;
    parsed.sectionType = sectionType;
    return parsed;
  } catch {
    return {
      sectionType,
      narrative: text,
      tables: [],
      chartDescriptions: [],
      pageCount: 0,
      keyFindings: [],
    };
  }
}

/**
 * Extract content from all indexed sections of a prior-year budget book.
 * Runs section extractions in parallel for speed.
 */
export async function extractPriorBudgetBookContent(
  ai: AiProvider,
  storage: StorageProvider,
  tenantId: string,
  s3Key: string,
  index: DocumentIndex
): Promise<Map<string, PriorSectionContent>> {
  const pdfBuffer = await storage.getObject(s3Key);
  const results = new Map<string, PriorSectionContent>();

  // Only extract sections that have a mapped section type
  const mappedSections = index.sections.filter((s) => s.mappedSectionType);

  // Run all extractions in parallel
  const extractions = await Promise.all(
    mappedSections.map((section) =>
      extractSection(
        ai,
        pdfBuffer,
        section.name,
        section.mappedSectionType!,
        section.startPage,
        section.endPage,
        tenantId,
      )
    )
  );

  for (const content of extractions) {
    if (content.narrative || content.tables.length > 0) {
      results.set(content.sectionType, content);
    }
  }

  return results;
}
