import { describe, it, expect } from "vitest";

describe("worker", () => {
  it("exports startWorker function", async () => {
    const mod = await import("../../src/worker/index.js");
    expect(mod.startWorker).toBeTypeOf("function");
  });

  it("startWorker accepts config with queue and createContext", async () => {
    const mod = await import("../../src/worker/index.js");
    expect(mod.startWorker.length).toBe(1); // single config object
  });

  it("registers handlers for generate and regenerate jobs", async () => {
    const mod = await import("../../src/worker/index.js");
    const { MockQueueProvider } = await import("../fixtures/mock-providers.js");
    const queue = new MockQueueProvider();

    const mockContext = {} as any;
    mod.startWorker({
      queue,
      createContext: () => mockContext,
    });

    // Verify both job types were registered
    const processedJobTypes = queue.calls
      .filter((c) => c.method === "process")
      .map((c) => c.args[0]);
    expect(processedJobTypes).toContain("generate-document");
    expect(processedJobTypes).toContain("regenerate-document");
  });
});
