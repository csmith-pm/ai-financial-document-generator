/**
 * Component Library types — defines the interface for reusable visual
 * components that can render to both HTML (web preview) and PDF.
 *
 * Components are referenced by ID in a LayoutSpec, which the Composer
 * agent produces to describe how a section should be visually composed.
 */

import type { ZodType } from "zod";
import type { ReactElement } from "react";

// ─── Component Styles ───────────────────────────────────────────────────

/**
 * Visual style context passed to every component renderer.
 * Derived from the prior-year StyleAnalysis + doc type defaults.
 */
export interface ComponentStyles {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    headerBg: string;
    borderColor: string;
    lightBg: string;
    text: string;
    muted: string;
    white: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    bodySize: number; // in pt
  };
  spacing: {
    sectionGap: number; // in px
    paragraphGap: number; // in px
  };
}

// ─── Component Definition ───────────────────────────────────────────────

export type ComponentCategory =
  | "chart"
  | "table"
  | "narrative"
  | "structural"
  | "stat"
  | "custom";

/**
 * A visual component that can render structured data to both
 * HTML (for web preview) and PDF (via @react-pdf/renderer).
 */
export interface ComponentDefinition {
  /** Unique component identifier, e.g. "bar-chart", "financial-table" */
  id: string;
  /** Semver version string */
  version: string;
  /** Human-readable display name */
  name: string;
  /** Optional description of what this component renders */
  description?: string;
  /** Component category for filtering */
  category: ComponentCategory;
  /** Zod schema for runtime props validation */
  propsSchema: ZodType;
  /**
   * Render to standard DOM React elements (for web preview).
   * Components render directly in the React tree — no iframes.
   */
  renderHtml: (
    props: unknown,
    styles: ComponentStyles
  ) => ReactElement;
  /**
   * Render to @react-pdf/renderer elements (for PDF output).
   */
  renderPdf: (
    props: unknown,
    styles: ComponentStyles
  ) => ReactElement;
  /** Whether this is a built-in component (true) or AI-generated (false) */
  builtIn: boolean;
  /** TypeScript source code for AI-created components (stored in DB) */
  source?: string;
  /** When the component was created (for AI-generated components) */
  createdAt?: Date;
}

// ─── Layout Spec ────────────────────────────────────────────────────────

/**
 * A single entry in a section's layout — references a component by ID
 * and passes props validated against that component's propsSchema.
 */
export interface LayoutEntry {
  /** Component ID from the registry */
  componentId: string;
  /** Optional version pin (defaults to latest) */
  componentVersion?: string;
  /** Props to pass to the component's render functions */
  props: Record<string, unknown>;
  /** Rendering order within the section (ascending) */
  order: number;
  /** Insert a page break before this component in PDF */
  pageBreakBefore?: boolean;
  /** Insert a page break after this component in PDF */
  pageBreakAfter?: boolean;
}

/**
 * Layout specification for a single section — produced by the Composer agent.
 */
export interface SectionLayoutSpec {
  sectionType: string;
  title: string;
  entries: LayoutEntry[];
}

/**
 * Full document layout — array of section layouts.
 */
export interface DocumentLayoutSpec {
  sections: SectionLayoutSpec[];
  /** Global style overrides (merged with ComponentStyles from style analysis) */
  globalStyles?: Partial<ComponentStyles>;
}
