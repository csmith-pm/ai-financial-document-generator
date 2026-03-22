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

  it("only registers generic job handlers (no legacy names)", async () => {
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

    // Only generic handlers — no legacy budget-book names
    expect(handlers.has("generate-budget-book")).toBe(false);
    expect(handlers.has("regenerate-budget-book")).toBe(false);
    expect(handlers.size).toBe(2);
  });
});
