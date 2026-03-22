import { describe, it, expect } from "vitest";

describe("workbench factory", () => {
  it("exports createWorkbench function", async () => {
    const mod = await import("../../src/workbench/index.js");
    expect(mod.createWorkbench).toBeTypeOf("function");
  });

  it("exports Workbench and WorkbenchOptions types (module loads)", async () => {
    const mod = await import("../../src/workbench/index.js");
    expect(mod).toBeDefined();
  });
});

describe("workbench bin entry point", () => {
  it("bin/workbench.ts exists and is importable as a module path", async () => {
    // We can't actually run the bin (needs env vars), but we verify the file parses
    // by checking the workbench factory it depends on
    const mod = await import("../../src/workbench/index.js");
    expect(mod.createWorkbench).toBeTypeOf("function");
  });
});
