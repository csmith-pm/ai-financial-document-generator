import { describe, it, expect } from "vitest";
import type {
  AiProvider,
  AiCallOptions,
  AiCallResult,
  AiJsonResult,
  AiVisionResult,
  StorageProvider,
  DataProvider,
  QueueProvider,
  EngineConfig,
  BudgetBookData,
  RevenueDetailRow,
  ExpenditureByDepartmentRow,
  PersonnelDetailRow,
  CapitalProjectDetail,
  ProjectionYear,
  CommunityProfile,
} from "../../src/core/providers.js";
import {
  MockAiProvider,
  MockStorageProvider,
  MockDataProvider,
  MockQueueProvider,
} from "../fixtures/mock-providers.js";

describe("Provider Interfaces", () => {
  describe("AiProvider", () => {
    it("MockAiProvider satisfies the AiProvider interface", () => {
      const ai: AiProvider = new MockAiProvider();
      expect(ai.callText).toBeTypeOf("function");
      expect(ai.callJson).toBeTypeOf("function");
      expect(ai.callVision).toBeTypeOf("function");
      expect(ai.logUsage).toBeTypeOf("function");
    });

    it("callText returns expected shape", async () => {
      const ai = new MockAiProvider();
      const result = await ai.callText("system", "user");
      expect(result).toHaveProperty("text");
      expect(result).toHaveProperty("inputTokens");
      expect(result).toHaveProperty("outputTokens");
      expect(result).toHaveProperty("model");
    });

    it("callJson returns expected shape", async () => {
      const ai = new MockAiProvider();
      const result = await ai.callJson<{ foo: string }>("system", "user");
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("inputTokens");
      expect(result).toHaveProperty("outputTokens");
      expect(result).toHaveProperty("model");
    });

    it("callVision returns expected shape", async () => {
      const ai = new MockAiProvider();
      const result = await ai.callVision("system", [Buffer.from("fake-image")]);
      expect(result).toHaveProperty("text");
      expect(result).toHaveProperty("inputTokens");
      expect(result).toHaveProperty("outputTokens");
    });

    it("tracks all calls", async () => {
      const ai = new MockAiProvider();
      await ai.callText("s", "u");
      await ai.callJson("s", "u");
      await ai.callVision("s", []);
      await ai.logUsage!("t1", "ep", 10, 20, "model");
      expect(ai.calls).toHaveLength(4);
      expect(ai.calls.map((c) => c.method)).toEqual([
        "callText",
        "callJson",
        "callVision",
        "logUsage",
      ]);
    });
  });

  describe("StorageProvider", () => {
    it("MockStorageProvider satisfies the StorageProvider interface", () => {
      const storage: StorageProvider = new MockStorageProvider();
      expect(storage.upload).toBeTypeOf("function");
      expect(storage.getObject).toBeTypeOf("function");
      expect(storage.getSignedUrl).toBeTypeOf("function");
    });

    it("upload and getObject round-trip", async () => {
      const storage = new MockStorageProvider();
      const buf = Buffer.from("test content");
      const key = await storage.upload("test/file.txt", buf, "text/plain");
      const retrieved = await storage.getObject(key);
      expect(retrieved).toEqual(buf);
    });

    it("getObject throws for missing key", async () => {
      const storage = new MockStorageProvider();
      await expect(storage.getObject("nonexistent")).rejects.toThrow("Object not found");
    });

    it("getSignedUrl returns URL with key", async () => {
      const storage = new MockStorageProvider();
      const url = await storage.getSignedUrl("test/file.pdf", 7200);
      expect(url).toContain("test/file.pdf");
      expect(url).toContain("7200");
    });
  });

  describe("DataProvider", () => {
    it("MockDataProvider satisfies the DataProvider interface", () => {
      const data: DataProvider = new MockDataProvider();
      expect(data.getDocumentData).toBeTypeOf("function");
    });

    it("returns document data with expected fields", async () => {
      const data = new MockDataProvider();
      const result = await data.getDocumentData("budget_book", "tenant-1", "ws-1", 2026) as Record<string, unknown>;
      expect(result).toHaveProperty("fiscalYear", 2026);
      expect(result).toHaveProperty("communityProfile");
      expect(result).toHaveProperty("revenueDetail");
      expect(result).toHaveProperty("expenditureByDepartment");
      expect(result).toHaveProperty("personnelDetail");
      expect(result).toHaveProperty("capitalProjects");
      expect(result).toHaveProperty("multiYearProjections");
      expect(result).toHaveProperty("totalRevenue");
      expect(result).toHaveProperty("totalExpenditure");
      expect(result).toHaveProperty("totalPersonnelCost");
      expect(result).toHaveProperty("totalCapitalCost");
    });
  });

  describe("QueueProvider", () => {
    it("MockQueueProvider satisfies the QueueProvider interface", () => {
      const queue: QueueProvider = new MockQueueProvider();
      expect(queue.enqueue).toBeTypeOf("function");
      expect(queue.process).toBeTypeOf("function");
    });

    it("executes handler on enqueue", async () => {
      const queue = new MockQueueProvider();
      let called = false;
      queue.process("test-job", async () => {
        called = true;
      });
      await queue.enqueue("test-job", { data: "test" });
      expect(called).toBe(true);
    });
  });

  describe("EngineConfig shape", () => {
    it("accepts a valid config object", () => {
      const config: EngineConfig = {
        ai: new MockAiProvider(),
        storage: new MockStorageProvider(),
        data: new MockDataProvider(),
        connectionString: "postgresql://localhost/test",
        maxIterations: 3,
        chartsEnabled: true,
        defaultModel: "claude-sonnet-4-20250514",
      };
      expect(config.ai).toBeDefined();
      expect(config.storage).toBeDefined();
      expect(config.data).toBeDefined();
      expect(config.connectionString).toBe("postgresql://localhost/test");
    });

    it("queue is optional", () => {
      const config: EngineConfig = {
        ai: new MockAiProvider(),
        storage: new MockStorageProvider(),
        data: new MockDataProvider(),
        connectionString: "postgresql://localhost/test",
      };
      expect(config.queue).toBeUndefined();
    });
  });

  describe("BudgetBookData types", () => {
    it("BudgetBookData has executiveSummary as optional", () => {
      const data: BudgetBookData = {
        fiscalYear: 2026,
        communityProfile: { name: "", state: "", population: 0, squareMiles: 0, formOfGovernment: "", established: "" },
        revenueDetail: [],
        expenditureByDepartment: [],
        personnelDetail: [],
        capitalProjects: [],
        multiYearProjections: [],
        totalRevenue: 0,
        totalExpenditure: 0,
        totalPersonnelCost: 0,
        totalCapitalCost: 0,
      };
      expect(data.executiveSummary).toBeUndefined();
    });

    it("CommunityProfile has all required fields", () => {
      const cp: CommunityProfile = {
        name: "Test City",
        state: "CA",
        population: 50000,
        squareMiles: 10,
        formOfGovernment: "Council-Manager",
        established: "1900",
      };
      expect(cp.name).toBe("Test City");
    });
  });
});
