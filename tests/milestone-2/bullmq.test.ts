import { describe, it, expect } from "vitest";

// BullMQ requires a real Redis connection to instantiate.
// We test the module structure and the MockQueueProvider behavior instead.

describe("BullMQQueueProvider", () => {
  describe("module exports", () => {
    it("exports BullMQQueueProvider class", async () => {
      const mod = await import("../../src/providers/bullmq.js");
      expect(mod.BullMQQueueProvider).toBeDefined();
      expect(typeof mod.BullMQQueueProvider).toBe("function");
    });
  });

  describe("class structure", () => {
    it("implements QueueProvider interface methods", async () => {
      const mod = await import("../../src/providers/bullmq.js");
      const proto = mod.BullMQQueueProvider.prototype;
      expect(proto.enqueue).toBeTypeOf("function");
      expect(proto.process).toBeTypeOf("function");
      expect(proto.shutdown).toBeTypeOf("function");
    });
  });
});

describe("MockQueueProvider (functional test)", () => {
  it("processes jobs synchronously via mock", async () => {
    const { MockQueueProvider } = await import("../fixtures/mock-providers.js");
    const queue = new MockQueueProvider();

    const results: string[] = [];
    queue.process("generate", async (payload) => {
      results.push(payload.bookId as string);
    });

    await queue.enqueue("generate", { bookId: "book-1" });
    await queue.enqueue("generate", { bookId: "book-2" });

    expect(results).toEqual(["book-1", "book-2"]);
  });

  it("tracks all enqueue and process calls", async () => {
    const { MockQueueProvider } = await import("../fixtures/mock-providers.js");
    const queue = new MockQueueProvider();

    queue.process("test", async () => {});
    await queue.enqueue("test", { data: "hello" });

    expect(queue.calls).toHaveLength(2);
    expect(queue.calls[0].method).toBe("process");
    expect(queue.calls[1].method).toBe("enqueue");
  });
});
