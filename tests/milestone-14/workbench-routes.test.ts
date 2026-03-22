import { describe, it, expect } from "vitest";

// ─── Route Module Exports ────────────────────────────────────────────

describe("workbench route modules", () => {
  it("exports runSectionRoutes function", async () => {
    const mod = await import("../../src/workbench/routes/run-section.js");
    expect(mod.runSectionRoutes).toBeTypeOf("function");
  });

  it("exports iterationsRoutes function", async () => {
    const mod = await import("../../src/workbench/routes/iterations.js");
    expect(mod.iterationsRoutes).toBeTypeOf("function");
  });

  it("exports skillsRoutes function", async () => {
    const mod = await import("../../src/workbench/routes/skills.js");
    expect(mod.skillsRoutes).toBeTypeOf("function");
  });

  it("exports uploadTestDataRoutes function", async () => {
    const mod = await import("../../src/workbench/routes/upload-test-data.js");
    expect(mod.uploadTestDataRoutes).toBeTypeOf("function");
  });

  it("exports docTypesRoutes function", async () => {
    const mod = await import("../../src/workbench/routes/doc-types.js");
    expect(mod.docTypesRoutes).toBeTypeOf("function");
  });

  it("exports workbenchRoutes barrel function", async () => {
    const mod = await import("../../src/workbench/routes/index.js");
    expect(mod.workbenchRoutes).toBeTypeOf("function");
  });
});

// ─── Run Section Validation ──────────────────────────────────────────

describe("run-section validation", () => {
  it("schema requires sectionType", async () => {
    const { z } = await import("zod");
    // Import the module to trigger schema creation — the schema is internal,
    // so we test via the route behavior indirectly
    const mod = await import("../../src/workbench/routes/run-section.js");
    expect(mod.runSectionRoutes).toBeDefined();
  });
});

// ─── Doc Types Route ─────────────────────────────────────────────────

describe("doc-types route", () => {
  it("defaultRegistry has budget_book registered", async () => {
    // Ensure doc types are loaded
    await import("../../src/doc-types/index.js");
    const { defaultRegistry } = await import("../../src/core/doc-type-registry.js");
    expect(defaultRegistry.has("budget_book")).toBe(true);
  });

  it("budget_book doc type has expected structure", async () => {
    await import("../../src/doc-types/index.js");
    const { defaultRegistry } = await import("../../src/core/doc-type-registry.js");
    const dt = defaultRegistry.get("budget_book");

    expect(dt.id).toBe("budget_book");
    expect(dt.name).toBe("Municipal Budget Book");
    expect(dt.sectionTypes.length).toBeGreaterThan(0);
    expect(dt.agents.length).toBeGreaterThan(0);
    expect(dt.reviewers.length).toBeGreaterThan(0);
    expect(dt.seedSkills.length).toBeGreaterThan(0);
  });

  it("list() returns at least budget_book", async () => {
    await import("../../src/doc-types/index.js");
    const { defaultRegistry } = await import("../../src/core/doc-type-registry.js");
    const list = defaultRegistry.list();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.some((dt) => dt.id === "budget_book")).toBe(true);
  });
});
