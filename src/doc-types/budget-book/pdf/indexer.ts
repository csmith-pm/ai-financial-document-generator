/**
 * Prior-Year Budget Book Indexer.
 *
 * Reads the prior PDF's early pages (cover, TOC, first content pages) via
 * vision API to build a structured DocumentIndex — mapping sections to page
 * ranges and extracting metadata like community profile.
 */

import type { AiProvider, StorageProvider } from "../../../core/providers.js";
import type { DocumentIndex } from "../../../core/types.js";
import { SECTION_TYPE_SPECS } from "../sections.js";

const INDEXER_PROMPT = `You are a municipal budget book analyst. You will receive images of pages from a prior-year budget book — typically the cover, table of contents, and first content pages.

Your job is to build a structured index of the document's sections.

Analyze the pages and extract:
1. The document title and fiscal year
2. A list of all major sections/chapters with their page numbers
3. For each section, identify whether it contains narrative text, data tables, and/or charts
4. Extract any community profile information (municipality name, state, population, form of government)

Map each section to one of these standard budget book section types if applicable:
${SECTION_TYPE_SPECS.map((s) => `- "${s.id}" (${s.name})`).join("\n")}

Respond with valid JSON:
{
  "title": "City of Bristol FY2026 Budget",
  "sections": [
    {
      "name": "About Bristol",
      "startPage": 7,
      "endPage": 12,
      "mappedSectionType": "community_profile",
      "hasNarrative": true,
      "hasTables": false,
      "hasCharts": false
    }
  ],
  "metadata": {
    "municipalityName": "City of Bristol",
    "state": "Connecticut",
    "population": 60000,
    "formOfGovernment": "Council-Mayor",
    "communityDescription": "Brief description of the community from the document..."
  }
}

Rules:
- Use exact page numbers from the table of contents
- Map sections to standard types where there's a clear match; use null for custom sections
- Include ALL sections listed in the TOC, even if you can't map them to a standard type
- For metadata, extract what you can see — use null for anything not visible`;

/**
 * Extract specific pages from a PDF as image buffers.
 */
async function extractPages(
  pdfBuffer: Buffer,
  pageNumbers: number[]
): Promise<Buffer[]> {
  try {
    const { pdf } = await import("pdf-to-img");
    const images: Buffer[] = [];
    const document = await pdf(pdfBuffer, { scale: 1.5 });
    let pageNum = 0;
    const targetSet = new Set(pageNumbers);

    for await (const page of document) {
      if (targetSet.has(pageNum)) {
        images.push(Buffer.from(page));
      }
      pageNum++;
      // Stop early if we've got all requested pages
      if (images.length >= targetSet.size) break;
    }
    return images;
  } catch {
    return [];
  }
}

/**
 * Index a prior-year budget book PDF to discover its section structure.
 */
export async function indexPriorBudgetBook(
  ai: AiProvider,
  storage: StorageProvider,
  tenantId: string,
  s3Key: string
): Promise<DocumentIndex> {
  const pdfBuffer = await storage.getObject(s3Key);

  // Extract cover + TOC + first few content pages (typically pages 0-8)
  const images = await extractPages(pdfBuffer, [0, 1, 2, 3, 4, 5, 6, 7, 8]);

  if (images.length === 0) {
    // Fallback: return a default index based on standard budget book sections
    return buildDefaultIndex();
  }

  const result = await ai.callVision(
    INDEXER_PROMPT,
    images,
    { model: "claude-sonnet-4-20250514", maxTokens: 4096, temperature: 0.1 },
  );

  await ai.logUsage?.(
    tenantId, "indexPriorBudgetBook",
    result.inputTokens, result.outputTokens, "claude-sonnet-4-20250514"
  );

  return parseIndexResult(result.text);
}

function parseIndexResult(text: string): DocumentIndex {
  let jsonStr = text.trim();
  const jsonMatch = /```(?:json)?\s*([\s\S]*?)```/.exec(jsonStr);
  if (jsonMatch?.[1]) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr) as DocumentIndex;
    // Ensure metadata exists
    if (!parsed.metadata) parsed.metadata = {};
    return parsed;
  } catch {
    return buildDefaultIndex();
  }
}

function buildDefaultIndex(): DocumentIndex {
  return {
    title: "Budget Book",
    sections: SECTION_TYPE_SPECS
      .filter((s) => !s.structural)
      .map((s, i) => ({
        name: s.name,
        startPage: i * 10,
        endPage: (i + 1) * 10 - 1,
        mappedSectionType: s.id,
        hasNarrative: true,
        hasTables: true,
        hasCharts: s.id !== "community_profile",
      })),
    metadata: {},
  };
}
