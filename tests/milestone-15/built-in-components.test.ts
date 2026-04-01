/**
 * Tests for built-in components — Phase 2 of the Component Library.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { defaultComponentRegistry } from "../../src/core/components/registry.js";
import type { ComponentStyles } from "../../src/core/components/types.js";

// Import built-ins to trigger registration
import "../../src/core/components/built-in/index.js";

const styles: ComponentStyles = {
  colors: {
    primary: "#1a365d",
    secondary: "#2d4a7a",
    accent: "#3182ce",
    headerBg: "#e2e8f0",
    borderColor: "#cbd5e0",
    lightBg: "#f7fafc",
    text: "#1a202c",
    muted: "#718096",
    white: "#ffffff",
  },
  typography: { headingFont: "Arial", bodyFont: "Arial", bodySize: 11 },
  spacing: { sectionGap: 24, paragraphGap: 12 },
};

describe("Built-in Components", () => {
  it("registers all 10 built-in components", () => {
    expect(defaultComponentRegistry.size).toBeGreaterThanOrEqual(10);
    expect(defaultComponentRegistry.has("narrative-block")).toBe(true);
    expect(defaultComponentRegistry.has("financial-table")).toBe(true);
    expect(defaultComponentRegistry.has("bar-chart")).toBe(true);
    expect(defaultComponentRegistry.has("pie-chart")).toBe(true);
    expect(defaultComponentRegistry.has("line-chart")).toBe(true);
    expect(defaultComponentRegistry.has("stacked-bar-chart")).toBe(true);
    expect(defaultComponentRegistry.has("grouped-bar-chart")).toBe(true);
    expect(defaultComponentRegistry.has("stat-card")).toBe(true);
    expect(defaultComponentRegistry.has("cover-page")).toBe(true);
    expect(defaultComponentRegistry.has("toc")).toBe(true);
  });

  it("all built-ins are marked builtIn: true", () => {
    for (const comp of defaultComponentRegistry.list()) {
      if (["narrative-block", "financial-table", "bar-chart", "pie-chart",
           "line-chart", "stacked-bar-chart", "grouped-bar-chart",
           "stat-card", "cover-page", "toc"].includes(comp.id)) {
        expect(comp.builtIn).toBe(true);
      }
    }
  });

  it("filters charts by category", () => {
    const charts = defaultComponentRegistry.listByCategory("chart");
    expect(charts.length).toBeGreaterThanOrEqual(5);
    expect(charts.every((c) => c.category === "chart")).toBe(true);
  });

  it("filters structural by category", () => {
    const structural = defaultComponentRegistry.listByCategory("structural");
    expect(structural.length).toBeGreaterThanOrEqual(2);
  });

  describe("narrative-block", () => {
    const comp = defaultComponentRegistry.get("narrative-block");

    it("validates props", () => {
      expect(comp.propsSchema.safeParse({ text: "Hello" }).success).toBe(true);
      expect(comp.propsSchema.safeParse({ text: 123 }).success).toBe(false);
      expect(comp.propsSchema.safeParse({}).success).toBe(false);
    });

    it("renderHtml produces a valid element", () => {
      const el = comp.renderHtml({ text: "Para one.\n\nPara two." }, styles);
      expect(React.isValidElement(el)).toBe(true);
    });

    it("renderPdf produces a valid element", () => {
      const el = comp.renderPdf({ text: "Some text" }, styles);
      expect(React.isValidElement(el)).toBe(true);
    });
  });

  describe("financial-table", () => {
    const comp = defaultComponentRegistry.get("financial-table");
    const validProps = {
      rows: [
        { header: true, cells: ["Fund", "Revenue", "Expense"] },
        { cells: ["General", "$1,000", "$900"] },
        { cells: ["Water", "$500", "$450"] },
      ],
    };

    it("validates props", () => {
      expect(comp.propsSchema.safeParse(validProps).success).toBe(true);
      expect(comp.propsSchema.safeParse({ rows: "invalid" }).success).toBe(false);
    });

    it("renderHtml produces a valid element", () => {
      const el = comp.renderHtml(validProps, styles);
      expect(React.isValidElement(el)).toBe(true);
    });

    it("renderPdf produces a valid element", () => {
      const el = comp.renderPdf(validProps, styles);
      expect(React.isValidElement(el)).toBe(true);
    });

    it("handles object-shaped cells gracefully", () => {
      const objCellProps = {
        rows: [
          { header: true, cells: [{ content: "Fund" }, { value: "Amount" }] },
          { cells: [{ text: "General" }, { label: "$500" }] },
        ],
      };
      const el = comp.renderHtml(objCellProps, styles);
      expect(React.isValidElement(el)).toBe(true);
    });
  });

  describe("bar-chart", () => {
    const comp = defaultComponentRegistry.get("bar-chart");
    const validProps = {
      title: "Revenue by Fund",
      chartType: "bar",
      data: [{ name: "General", revenue: 1000 }],
      dataKeys: ["revenue"],
      categoryKey: "name",
    };

    it("validates props", () => {
      expect(comp.propsSchema.safeParse(validProps).success).toBe(true);
    });

    it("renderHtml produces a valid element", () => {
      const el = comp.renderHtml(validProps, styles);
      expect(React.isValidElement(el)).toBe(true);
    });

    it("renderPdf produces a valid element (no image)", () => {
      const el = comp.renderPdf(validProps, styles);
      expect(React.isValidElement(el)).toBe(true);
    });
  });

  describe("stat-card", () => {
    const comp = defaultComponentRegistry.get("stat-card");

    it("validates props with and without trend", () => {
      expect(comp.propsSchema.safeParse({ label: "Revenue", value: "$1.2M" }).success).toBe(true);
      expect(comp.propsSchema.safeParse({ label: "Revenue", value: "$1.2M", trend: "+4.2%" }).success).toBe(true);
    });

    it("renderHtml produces a valid element", () => {
      const el = comp.renderHtml({ label: "Revenue", value: "$1.2M", trend: "+4.2%" }, styles);
      expect(React.isValidElement(el)).toBe(true);
    });
  });

  describe("cover-page", () => {
    const comp = defaultComponentRegistry.get("cover-page");

    it("validates props", () => {
      expect(comp.propsSchema.safeParse({
        communityName: "Bristol, CT",
        fiscalYear: 2027,
      }).success).toBe(true);
    });

    it("renderHtml produces a valid element", () => {
      const el = comp.renderHtml({
        communityName: "Bristol, CT",
        fiscalYear: 2027,
      }, styles);
      expect(React.isValidElement(el)).toBe(true);
    });
  });

  describe("toc", () => {
    const comp = defaultComponentRegistry.get("toc");

    it("validates props", () => {
      expect(comp.propsSchema.safeParse({
        entries: [
          { title: "Executive Summary", page: 3 },
          { title: "Revenue", page: 5 },
        ],
      }).success).toBe(true);
    });

    it("renderHtml produces a valid element", () => {
      const el = comp.renderHtml({
        entries: [{ title: "Executive Summary", page: 3 }],
      }, styles);
      expect(React.isValidElement(el)).toBe(true);
    });
  });
});
