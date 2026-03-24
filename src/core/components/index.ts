/**
 * Component Library — public API.
 *
 * Re-exports the registry, types, and (once built-ins are loaded)
 * provides the default component registry populated with all
 * built-in components.
 */

export { ComponentRegistry, defaultComponentRegistry } from "./registry.js";
export { createComponent, loadCustomComponents } from "./creator.js";
export type {
  ComponentDefinition,
  ComponentCategory,
  ComponentStyles,
  LayoutEntry,
  SectionLayoutSpec,
  DocumentLayoutSpec,
} from "./types.js";
