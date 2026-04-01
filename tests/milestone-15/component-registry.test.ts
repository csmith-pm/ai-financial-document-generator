/**
 * Tests for the ComponentRegistry — Phase 1 of the Component Library.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import React from "react";
import { ComponentRegistry } from "../../src/core/components/registry.js";
import type {
  ComponentDefinition,
  ComponentStyles,
} from "../../src/core/components/types.js";

// ─── Helpers ────────────────────────────────────────────────────────────

const defaultStyles: ComponentStyles = {
  colors: {
    primary: "#1B4F72",
    secondary: "#2E86C1",
    accent: "#F39C12",
    headerBg: "#D5E8F0",
    borderColor: "#BDC3C7",
    lightBg: "#F8F9FA",
    text: "#2C3E50",
    muted: "#7F8C8D",
    white: "#FFFFFF",
  },
  typography: {
    headingFont: "Arial",
    bodyFont: "Arial",
    bodySize: 11,
  },
  spacing: {
    sectionGap: 24,
    paragraphGap: 12,
  },
};

function makeComponent(
  id: string,
  category: ComponentDefinition["category"] = "narrative"
): ComponentDefinition {
  return {
    id,
    version: "1.0.0",
    name: `Test ${id}`,
    category,
    propsSchema: z.object({ text: z.string() }),
    renderHtml: (_props, _styles) =>
      React.createElement("div", null, "html"),
    renderPdf: (_props, _styles) =>
      React.createElement("div", null, "pdf"),
    builtIn: true,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe("ComponentRegistry", () => {
  let registry: ComponentRegistry;

  beforeEach(() => {
    registry = new ComponentRegistry();
  });

  it("registers and retrieves a component", () => {
    const comp = makeComponent("narrative-block");
    registry.register(comp);

    const retrieved = registry.get("narrative-block");
    expect(retrieved.id).toBe("narrative-block");
    expect(retrieved.name).toBe("Test narrative-block");
  });

  it("throws on duplicate ID registration", () => {
    registry.register(makeComponent("bar-chart", "chart"));
    expect(() => registry.register(makeComponent("bar-chart", "chart"))).toThrow(
      'Component "bar-chart" is already registered'
    );
  });

  it("throws on unknown ID lookup", () => {
    expect(() => registry.get("nonexistent")).toThrow(
      'Unknown component: "nonexistent"'
    );
  });

  it("checks existence with has()", () => {
    expect(registry.has("foo")).toBe(false);
    registry.register(makeComponent("foo"));
    expect(registry.has("foo")).toBe(true);
  });

  it("lists all registered components", () => {
    registry.register(makeComponent("a"));
    registry.register(makeComponent("b"));
    registry.register(makeComponent("c"));

    const all = registry.list();
    expect(all).toHaveLength(3);
    expect(all.map((c) => c.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("filters by category with listByCategory()", () => {
    registry.register(makeComponent("chart-1", "chart"));
    registry.register(makeComponent("chart-2", "chart"));
    registry.register(makeComponent("table-1", "table"));
    registry.register(makeComponent("narr-1", "narrative"));

    expect(registry.listByCategory("chart")).toHaveLength(2);
    expect(registry.listByCategory("table")).toHaveLength(1);
    expect(registry.listByCategory("narrative")).toHaveLength(1);
    expect(registry.listByCategory("structural")).toHaveLength(0);
  });

  it("tracks size correctly", () => {
    expect(registry.size).toBe(0);
    registry.register(makeComponent("a"));
    expect(registry.size).toBe(1);
    registry.register(makeComponent("b"));
    expect(registry.size).toBe(2);
  });

  it("registerDynamic overwrites existing components", () => {
    const original = makeComponent("dynamic-comp");
    registry.register(original);
    expect(registry.get("dynamic-comp").version).toBe("1.0.0");

    const updated = { ...makeComponent("dynamic-comp"), version: "2.0.0" };
    registry.registerDynamic(updated);
    expect(registry.get("dynamic-comp").version).toBe("2.0.0");
    expect(registry.size).toBe(1);
  });

  it("component renderHtml produces a React element", () => {
    const comp = makeComponent("test");
    registry.register(comp);

    const el = comp.renderHtml({ text: "hello" }, defaultStyles);
    expect(React.isValidElement(el)).toBe(true);
  });

  it("component renderPdf produces a React element", () => {
    const comp = makeComponent("test");
    registry.register(comp);

    const el = comp.renderPdf({ text: "hello" }, defaultStyles);
    expect(React.isValidElement(el)).toBe(true);
  });

  it("component propsSchema validates props", () => {
    const comp = makeComponent("test");
    const result = comp.propsSchema.safeParse({ text: "valid" });
    expect(result.success).toBe(true);

    const invalid = comp.propsSchema.safeParse({ text: 123 });
    expect(invalid.success).toBe(false);
  });
});
