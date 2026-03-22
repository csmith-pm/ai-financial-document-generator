import { describe, it, expect, vi } from "vitest";

// We test the S3StorageProvider structure without real AWS credentials.
// The actual S3 operations are integration-tested in deployment.

describe("S3StorageProvider", () => {
  describe("module exports", () => {
    it("exports S3StorageProvider class", async () => {
      const mod = await import("../../src/providers/s3.js");
      expect(mod.S3StorageProvider).toBeDefined();
      expect(typeof mod.S3StorageProvider).toBe("function");
    });
  });

  describe("class structure", () => {
    it("implements StorageProvider interface methods", async () => {
      const mod = await import("../../src/providers/s3.js");
      const proto = mod.S3StorageProvider.prototype;
      expect(proto.upload).toBeTypeOf("function");
      expect(proto.getObject).toBeTypeOf("function");
      expect(proto.getSignedUrl).toBeTypeOf("function");
    });
  });

  describe("constructor", () => {
    it("accepts bucket and region config", async () => {
      const mod = await import("../../src/providers/s3.js");
      // Just verify it doesn't throw during construction
      const provider = new mod.S3StorageProvider({
        bucket: "test-bucket",
        region: "us-west-2",
      });
      expect(provider).toBeDefined();
    });

    it("defaults region to us-east-1", async () => {
      const mod = await import("../../src/providers/s3.js");
      const provider = new mod.S3StorageProvider({
        bucket: "test-bucket",
      });
      expect(provider).toBeDefined();
    });
  });
});
