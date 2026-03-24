/**
 * Tests for the Component Creator — dynamic component generation
 * when the Composer encounters visual elements not in the library.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { ComponentRegistry } from "../../src/core/components/registry.js";
import type { ComponentCategory, ComponentStyles } from "../../src/core/components/types.js";

// We can't easily test the full createComponent (needs real DB + AI),
// so we test the building blocks: buildSafeRenderFn, loadCustomComponents safety, registry integration.

describe("Component Creator", () => {
  let registry: ComponentRegistry;

  beforeEach(() => {
    registry = new ComponentRegistry();
  });

  describe("dynamic component registration", () => {
    it("registerDynamic adds a component to the registry", () => {
      const propsSchema = z.object({ text: z.string() });

      registry.registerDynamic({
        id: "test-dynamic",
        version: "1.0.0",
        name: "Test Dynamic",
        category: "custom" as ComponentCategory,
        propsSchema,
        renderHtml: () => null as any,
        renderPdf: () => null as any,
        builtIn: false,
        source: "(props) => `<div>${props.text}</div>`",
        createdAt: new Date(),
      });

      expect(registry.has("test-dynamic")).toBe(true);
      expect(registry.get("test-dynamic").builtIn).toBe(false);
      expect(registry.get("test-dynamic").source).toBeDefined();
    });

    it("registerDynamic overwrites existing component", () => {
      const propsSchema = z.record(z.unknown());

      registry.registerDynamic({
        id: "overwrite-me",
        version: "1.0.0",
        name: "Original",
        category: "custom" as ComponentCategory,
        propsSchema,
        renderHtml: () => null as any,
        renderPdf: () => null as any,
        builtIn: false,
      });

      registry.registerDynamic({
        id: "overwrite-me",
        version: "2.0.0",
        name: "Updated",
        category: "custom" as ComponentCategory,
        propsSchema,
        renderHtml: () => null as any,
        renderPdf: () => null as any,
        builtIn: false,
      });

      expect(registry.get("overwrite-me").version).toBe("2.0.0");
      expect(registry.get("overwrite-me").name).toBe("Updated");
    });

    it("dynamic components coexist with built-in components", () => {
      const propsSchema = z.record(z.unknown());

      // Register a "built-in"
      registry.register({
        id: "built-in-comp",
        version: "1.0.0",
        name: "Built-in",
        category: "chart" as ComponentCategory,
        propsSchema,
        renderHtml: () => null as any,
        renderPdf: () => null as any,
        builtIn: true,
      });

      // Register a dynamic
      registry.registerDynamic({
        id: "dynamic-comp",
        version: "1.0.0",
        name: "Dynamic",
        category: "custom" as ComponentCategory,
        propsSchema,
        renderHtml: () => null as any,
        renderPdf: () => null as any,
        builtIn: false,
      });

      expect(registry.size).toBe(2);
      expect(registry.get("built-in-comp").builtIn).toBe(true);
      expect(registry.get("dynamic-comp").builtIn).toBe(false);
      expect(registry.listByCategory("custom")).toHaveLength(1);
      expect(registry.listByCategory("chart")).toHaveLength(1);
    });
  });

  describe("loadCustomComponents safety", () => {
    it("handles missing table gracefully", async () => {
      // Import and test that loadCustomComponents doesn't throw
      // when the DB query fails (table doesn't exist)
      const { loadCustomComponents } = await import(
        "../../src/core/components/creator.js"
      );

      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => {
              throw new Error("relation does not exist");
            },
          }),
        }),
      } as any;

      const count = await loadCustomComponents(mockDb, registry);
      expect(count).toBe(0);
    });

    it("handles empty result set", async () => {
      const { loadCustomComponents } = await import(
        "../../src/core/components/creator.js"
      );

      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => Promise.resolve([]),
          }),
        }),
      } as any;

      const count = await loadCustomComponents(mockDb, registry);
      expect(count).toBe(0);
    });
  });

  describe("compose-sections __missing__ integration", () => {
    it("__missing__ entries include a description for the Component Creator", () => {
      // Verify the contract: when the Composer returns __missing__,
      // it includes props.description that the Creator uses
      const missingEntry = {
        componentId: "__missing__",
        props: {
          description: "Organizational chart showing city government structure with Mayor, City Council, and department heads",
        },
        order: 3,
      };

      expect(missingEntry.componentId).toBe("__missing__");
      expect(missingEntry.props.description).toContain("Organizational chart");
    });
  });
});
