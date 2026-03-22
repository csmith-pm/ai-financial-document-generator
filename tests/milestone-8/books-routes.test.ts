import { describe, it, expect } from "vitest";

describe("books routes", () => {
  it("exports booksRoutes function", async () => {
    const mod = await import("../../src/api/routes/books.js");
    expect(mod.booksRoutes).toBeTypeOf("function");
  });

  it("exports BooksRouteDeps interface (module loads)", async () => {
    const mod = await import("../../src/api/routes/books.js");
    expect(mod).toBeDefined();
  });
});

describe("server", () => {
  it("exports createServer function", async () => {
    const mod = await import("../../src/api/server.js");
    expect(mod.createServer).toBeTypeOf("function");
  });
});
