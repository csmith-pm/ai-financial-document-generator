import { describe, it, expect, beforeEach } from "vitest";
import {
  DocumentTypeRegistry,
  defaultRegistry,
} from "../../src/core/doc-type-registry.js";
import type { DocumentTypeDefinition } from "../../src/core/doc-type.js";
import { z } from "zod";

/** Minimal stub satisfying the DocumentTypeDefinition interface. */
function makeStubDocType(
  id: string,
  overrides: Partial<DocumentTypeDefinition> = {}
): DocumentTypeDefinition {
  return {
    id,
    name: `Test ${id}`,
    version: "0.0.1",
    dataSchema: z.object({}),
    sectionTypes: [],
    getSectionData: () => ({}),
    getSectionPrompt: () => "",
    agents: [],
    getAgent: () => {
      throw new Error("not implemented");
    },
    reviewers: [],
    seedSkills: [],
    categoryPriority: {},
    detectDataGaps: () => [],
    advisorAgentType: "test_advisor",
    storagePrefix: "test-docs",
    ...overrides,
  };
}

describe("DocumentTypeRegistry", () => {
  let registry: DocumentTypeRegistry;

  beforeEach(() => {
    registry = new DocumentTypeRegistry();
  });

  it("starts empty", () => {
    expect(registry.list()).toEqual([]);
    expect(registry.has("anything")).toBe(false);
  });

  it("registers and retrieves a doc type", () => {
    const dt = makeStubDocType("test_doc");
    registry.register(dt);

    expect(registry.has("test_doc")).toBe(true);
    expect(registry.get("test_doc")).toBe(dt);
  });

  it("throws on unknown doc type", () => {
    expect(() => registry.get("nonexistent")).toThrow(
      'Unknown document type: "nonexistent"'
    );
  });

  it("throws on duplicate registration", () => {
    registry.register(makeStubDocType("dup"));
    expect(() => registry.register(makeStubDocType("dup"))).toThrow(
      'Document type "dup" is already registered'
    );
  });

  it("lists all registered types", () => {
    const a = makeStubDocType("alpha");
    const b = makeStubDocType("beta");
    registry.register(a);
    registry.register(b);

    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list).toContain(a);
    expect(list).toContain(b);
  });

  it("exports a default singleton registry", () => {
    expect(defaultRegistry).toBeInstanceOf(DocumentTypeRegistry);
  });
});
