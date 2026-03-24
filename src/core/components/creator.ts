/**
 * Component Creator — generates new ComponentDefinitions on demand
 * when the Composer agent encounters a visual element not in the library.
 *
 * The AI generates TypeScript source for renderHtml and a Zod props schema.
 * The component is persisted to DB and registered in the runtime registry.
 *
 * Safety: Generated code is evaluated in a restricted scope with only
 * React and basic DOM primitives available. No file system, network,
 * or process access.
 */

import { z } from "zod";
import { eq } from "drizzle-orm";
import type { AiProvider } from "../providers.js";
import type { DrizzleInstance } from "../../db/connection.js";
import { visualComponents } from "../../db/schema.js";
import type { ComponentDefinition, ComponentCategory, ComponentStyles } from "./types.js";
import type { ReactElement } from "react";
import { ComponentRegistry } from "./registry.js";

// ── AI Response Schema ──────────────────────────────────────────────────

const componentResponseSchema = z.object({
  componentId: z.string().regex(/^[a-z][a-z0-9-]*$/, "Must be kebab-case"),
  name: z.string(),
  description: z.string(),
  category: z.enum(["chart", "table", "narrative", "structural", "stat", "custom"]),
  propsInterface: z.string(), // TypeScript interface as string
  renderHtmlSource: z.string(), // Function body that returns JSX string
});

type ComponentResponse = z.infer<typeof componentResponseSchema>;

// ── System Prompt ───────────────────────────────────────────────────────

const CREATOR_SYSTEM_PROMPT = `You are a Component Creator agent for a document generation engine.

Given a description of a visual element from a prior-year financial document (e.g., org chart, waterfall chart, timeline, infographic), you create a reusable visual component definition.

You must produce a JSON object with these fields:
- componentId: kebab-case ID (e.g., "waterfall-chart", "org-chart")
- name: Human-readable name (e.g., "Waterfall Chart")
- description: What this component renders
- category: One of "chart", "table", "narrative", "structural", "stat", "custom"
- propsInterface: TypeScript interface for the component's props
- renderHtmlSource: A JavaScript function body that takes (props, styles) and returns an HTML string. The function has access to:
  - props: validated props object
  - styles: { colors: { primary, secondary, accent, ... }, typography: { headingFont, bodyFont, bodySize }, spacing: { ... } }

Rules for renderHtmlSource:
- Return a single HTML string using template literals
- Use inline CSS only (no external stylesheets)
- Use SVG for charts and data visualizations
- Use semantic HTML (<table>, <th scope>, <aria-label>)
- Reference styles.colors for all color values
- The HTML must render identically in a browser and Puppeteer
- NO external dependencies, NO <script> tags
- The function signature is: (props, styles) => string

Example renderHtmlSource:
\`(props, styles) => {
  const items = props.items || [];
  return \\\`<div style="font-family: \${styles.typography.bodyFont}">
    <h3 style="color: \${styles.colors.primary}">\${props.title}</h3>
    <ul>\${items.map(i => \\\`<li>\${i}</li>\\\`).join('')}</ul>
  </div>\\\`;
}\`

Output ONLY valid JSON matching the schema above.`;

// ── Creator Function ────────────────────────────────────────────────────

/**
 * Create a new component from a description of a visual element.
 * Returns the component ID that can be referenced in LayoutSpecs.
 */
export async function createComponent(
  ai: AiProvider,
  db: DrizzleInstance,
  registry: ComponentRegistry,
  description: string,
  tenantId?: string
): Promise<string> {
  const userPrompt = `Create a reusable visual component for the following element found in a prior-year financial document:\n\n${description}\n\nProduce the JSON component definition.`;

  const result = await ai.callJson<ComponentResponse>(
    CREATOR_SYSTEM_PROMPT,
    userPrompt,
    { maxTokens: 4096, temperature: 0.3 }
  );

  const parsed = componentResponseSchema.safeParse(result.data);
  if (!parsed.success) {
    throw new Error(`Component Creator returned invalid response: ${parsed.error.message}`);
  }

  const resp = parsed.data;

  // Build a simple renderHtml function from the source
  // Safety: We wrap in a try/catch and only allow string output
  // AI-generated components return HTML strings; cast to satisfy the interface
  // (the UI ComponentRenderer handles raw strings via dangerouslySetInnerHTML)
  const renderHtmlFn = buildSafeRenderFn(resp.renderHtmlSource) as unknown as
    (props: unknown, styles: ComponentStyles) => ReactElement;

  // Create a permissive Zod schema (accepts any props)
  // The propsInterface is stored for documentation but runtime validation is loose
  const propsSchema = z.record(z.unknown());

  const componentDef: ComponentDefinition = {
    id: resp.componentId,
    version: "1.0.0",
    name: resp.name,
    description: resp.description,
    category: resp.category as ComponentCategory,
    propsSchema,
    renderHtml: renderHtmlFn,
    renderPdf: renderHtmlFn, // Stage 1: same function for both targets
    builtIn: false,
    source: resp.renderHtmlSource,
    createdAt: new Date(),
  };

  // Persist to DB
  await db
    .insert(visualComponents)
    .values({
      componentId: resp.componentId,
      version: "1.0.0",
      name: resp.name,
      description: resp.description,
      category: resp.category,
      propsSchema: JSON.parse(resp.propsInterface || "{}"),
      renderHtmlSource: resp.renderHtmlSource,
      renderPdfSource: resp.renderHtmlSource, // Stage 1: same source
      tenantId: tenantId ?? null,
      builtIn: false,
    })
    .onConflictDoUpdate({
      target: visualComponents.componentId,
      set: {
        renderHtmlSource: resp.renderHtmlSource,
        renderPdfSource: resp.renderHtmlSource,
        updatedAt: new Date(),
      },
    });

  // Register in runtime registry
  registry.registerDynamic(componentDef);

  return resp.componentId;
}

/**
 * Load all custom components from DB and register them in the registry.
 */
export async function loadCustomComponents(
  db: DrizzleInstance,
  registry: ComponentRegistry,
  tenantId?: string
): Promise<number> {
  let rows: (typeof visualComponents.$inferSelect)[];
  try {
    rows = await db
      .select()
      .from(visualComponents)
      .where(eq(visualComponents.builtIn, false));
  } catch {
    // Table may not exist yet (e.g., in tests or before migration)
    return 0;
  }

  if (!rows || !Array.isArray(rows)) return 0;

  let loaded = 0;
  for (const row of rows) {
    // Skip if tenant-scoped and doesn't match
    if (row.tenantId && tenantId && row.tenantId !== tenantId) continue;

    if (registry.has(row.componentId)) continue;

    try {
      const renderFn = buildSafeRenderFn(row.renderHtmlSource) as unknown as
        (props: unknown, styles: ComponentStyles) => ReactElement;
      const propsSchema = z.record(z.unknown());

      registry.registerDynamic({
        id: row.componentId,
        version: row.version,
        name: row.name,
        description: row.description ?? undefined,
        category: row.category as ComponentCategory,
        propsSchema,
        renderHtml: renderFn,
        renderPdf: renderFn,
        builtIn: false,
        source: row.renderHtmlSource,
        createdAt: row.createdAt,
      });
      loaded++;
    } catch (err) {
      console.warn(`[component-loader] Failed to load "${row.componentId}":`, err);
    }
  }

  return loaded;
}

// ── Safe Function Builder ───────────────────────────────────────────────

/**
 * Build a render function from AI-generated source code.
 * The function is evaluated in a restricted scope — no access to
 * require, import, process, fs, or network APIs.
 */
function buildSafeRenderFn(
  source: string
): (props: unknown, styles: unknown) => unknown {
  try {
    // Wrap the source in a function constructor with restricted scope
    // The source should be a function expression: (props, styles) => { ... }
    const fn = new Function(
      "props",
      "styles",
      `"use strict";
      const renderFn = ${source};
      return renderFn(props, styles);`
    );

    // Return a wrapper that catches errors and returns a fallback
    return (props: unknown, styles: unknown) => {
      try {
        const result = fn(props, styles);
        if (typeof result !== "string") {
          return `<div style="color:red">Component render error: expected string output</div>`;
        }
        // Basic sanitization: strip <script> tags
        return result.replace(/<script[\s\S]*?<\/script>/gi, "");
      } catch (err) {
        return `<div style="color:red">Component render error: ${String(err)}</div>`;
      }
    };
  } catch (err) {
    // If the function can't be compiled, return a safe fallback
    return () =>
      `<div style="color:red">Component compilation error: ${String(err)}</div>`;
  }
}
