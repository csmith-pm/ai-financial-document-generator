/**
 * ComponentRegistry — in-memory registry of visual component definitions.
 *
 * Mirrors the DocumentTypeRegistry pattern: components register themselves
 * at import time (built-ins) or at runtime (AI-generated). The Composer
 * agent references components by ID when building LayoutSpecs.
 */

import type { ComponentDefinition, ComponentCategory } from "./types.js";

export class ComponentRegistry {
  private components = new Map<string, ComponentDefinition>();

  /** Register a component. Throws if the ID is already taken. */
  register(component: ComponentDefinition): void {
    if (this.components.has(component.id)) {
      throw new Error(
        `Component "${component.id}" is already registered`
      );
    }
    this.components.set(component.id, component);
  }

  /**
   * Register a dynamically created component (e.g., AI-generated).
   * Overwrites any existing component with the same ID.
   */
  registerDynamic(component: ComponentDefinition): void {
    this.components.set(component.id, component);
  }

  /** Get a component by ID. Throws if unknown. */
  get(id: string): ComponentDefinition {
    const comp = this.components.get(id);
    if (!comp) {
      throw new Error(`Unknown component: "${id}"`);
    }
    return comp;
  }

  /** Check if a component is registered. */
  has(id: string): boolean {
    return this.components.has(id);
  }

  /** List all registered components. */
  list(): ComponentDefinition[] {
    return [...this.components.values()];
  }

  /** List components filtered by category. */
  listByCategory(category: ComponentCategory): ComponentDefinition[] {
    return this.list().filter((c) => c.category === category);
  }

  /** Get the count of registered components. */
  get size(): number {
    return this.components.size;
  }
}

/** Singleton registry used by the engine. */
export const defaultComponentRegistry = new ComponentRegistry();
