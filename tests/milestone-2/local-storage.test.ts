import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalStorageProvider } from "../../src/providers/local-storage.js";
import { rm, stat } from "node:fs/promises";
import { join } from "node:path";

const TEST_DIR = "/tmp/document-engine-test-" + Date.now();

describe("LocalStorageProvider", () => {
  let storage: LocalStorageProvider;

  beforeEach(() => {
    storage = new LocalStorageProvider({ baseDir: TEST_DIR });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe("upload", () => {
    it("creates file on disk and returns the key", async () => {
      const buf = Buffer.from("hello world");
      const key = await storage.upload("test/file.txt", buf, "text/plain");
      expect(key).toBe("test/file.txt");

      const fileStat = await stat(join(TEST_DIR, "test/file.txt"));
      expect(fileStat.isFile()).toBe(true);
    });

    it("creates nested directories as needed", async () => {
      const buf = Buffer.from("nested content");
      await storage.upload("a/b/c/deep.txt", buf, "text/plain");

      const fileStat = await stat(join(TEST_DIR, "a/b/c/deep.txt"));
      expect(fileStat.isFile()).toBe(true);
    });

    it("overwrites existing files", async () => {
      const buf1 = Buffer.from("version 1");
      const buf2 = Buffer.from("version 2");
      await storage.upload("overwrite.txt", buf1, "text/plain");
      await storage.upload("overwrite.txt", buf2, "text/plain");

      const retrieved = await storage.getObject("overwrite.txt");
      expect(retrieved.toString()).toBe("version 2");
    });
  });

  describe("getObject", () => {
    it("retrieves uploaded content", async () => {
      const buf = Buffer.from("retrieve me");
      await storage.upload("get-test.txt", buf, "text/plain");

      const result = await storage.getObject("get-test.txt");
      expect(result.toString()).toBe("retrieve me");
    });

    it("preserves binary content", async () => {
      const buf = Buffer.from([0x00, 0xff, 0x42, 0x89, 0x50, 0x4e, 0x47]);
      await storage.upload("binary.bin", buf, "application/octet-stream");

      const result = await storage.getObject("binary.bin");
      expect(Buffer.compare(result, buf)).toBe(0);
    });

    it("throws for non-existent key", async () => {
      await expect(storage.getObject("nonexistent.txt")).rejects.toThrow();
    });
  });

  describe("getSignedUrl", () => {
    it("returns a URL containing the key", async () => {
      const url = await storage.getSignedUrl("reports/budget.pdf");
      expect(url).toContain("reports/budget.pdf");
    });

    it("uses configured baseUrl", async () => {
      const customStorage = new LocalStorageProvider({
        baseDir: TEST_DIR,
        baseUrl: "http://localhost:4000/files",
      });
      const url = await customStorage.getSignedUrl("doc.pdf");
      expect(url).toBe("http://localhost:4000/files/doc.pdf");
    });

    it("defaults to file:// URL", async () => {
      const url = await storage.getSignedUrl("doc.pdf");
      expect(url).toContain("file://");
    });
  });

  describe("round-trip integration", () => {
    it("upload → getObject → getSignedUrl works end-to-end", async () => {
      const content = JSON.stringify({ budget: 1_000_000, year: 2026 });
      const buf = Buffer.from(content);

      const key = await storage.upload(
        "tenant-1/books/book-1/data.json",
        buf,
        "application/json"
      );

      const retrieved = await storage.getObject(key);
      expect(JSON.parse(retrieved.toString())).toEqual({
        budget: 1_000_000,
        year: 2026,
      });

      const url = await storage.getSignedUrl(key);
      expect(url).toContain("tenant-1/books/book-1/data.json");
    });
  });
});
