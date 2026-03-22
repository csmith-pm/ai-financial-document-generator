import { describe, it, expect, vi } from "vitest";

describe("worker registers generic job handlers", () => {
  it("registers generate-document handler", async () => {
    const { startWorker } = await import("../../src/worker/index.js");

    const handlers = new Map<string, Function>();
    const mockQueue = {
      enqueue: vi.fn(),
      process: vi.fn((jobType: string, handler: Function) => {
        handlers.set(jobType, handler);
      }),
    };
    const mockCreateContext = vi.fn(() => ({} as never));

    startWorker({ queue: mockQueue, createContext: mockCreateContext });

    expect(handlers.has("generate-document")).toBe(true);
    expect(handlers.has("regenerate-document")).toBe(true);
  });

  it("registers backward-compatible job handlers", async () => {
    const { startWorker } = await import("../../src/worker/index.js");

    const handlers = new Map<string, Function>();
    const mockQueue = {
      enqueue: vi.fn(),
      process: vi.fn((jobType: string, handler: Function) => {
        handlers.set(jobType, handler);
      }),
    };
    const mockCreateContext = vi.fn(() => ({} as never));

    startWorker({ queue: mockQueue, createContext: mockCreateContext });

    // Legacy names still registered
    expect(handlers.has("generate-budget-book")).toBe(true);
    expect(handlers.has("regenerate-budget-book")).toBe(true);

    // Total: 4 handlers (2 generic + 2 legacy)
    expect(handlers.size).toBe(4);
  });
});
