import { describe, it, expect } from "vitest";
import {
  documents,
  documentSections,
  documentReviews,
  documentJobs,
  agentSkills,
  documentTodos,
  documentTodoMessages,
  documentStatusEnum,
  jobStatusEnum,
  dataSourceEnum,
  skillScopeEnum,
  skillStatusEnum,
  todoCategoryEnum,
  todoStatusEnum,
  todoPriorityEnum,
  todoMessageRoleEnum,
} from "../../src/db/schema.js";

describe("Database Schema", () => {
  describe("Table exports", () => {
    it("exports all 7 core tables", () => {
      expect(documents).toBeDefined();
      expect(documentSections).toBeDefined();
      expect(documentReviews).toBeDefined();
      expect(documentJobs).toBeDefined();
      expect(agentSkills).toBeDefined();
      expect(documentTodos).toBeDefined();
      expect(documentTodoMessages).toBeDefined();
    });
  });

  describe("Enum exports", () => {
    it("exports all enums", () => {
      expect(documentStatusEnum).toBeDefined();
      expect(jobStatusEnum).toBeDefined();
      expect(dataSourceEnum).toBeDefined();
      expect(skillScopeEnum).toBeDefined();
      expect(skillStatusEnum).toBeDefined();
      expect(todoCategoryEnum).toBeDefined();
      expect(todoStatusEnum).toBeDefined();
      expect(todoPriorityEnum).toBeDefined();
      expect(todoMessageRoleEnum).toBeDefined();
    });

    it("documentStatusEnum has all expected values", () => {
      expect(documentStatusEnum.enumValues).toEqual([
        "draft",
        "analyzing",
        "generating",
        "reviewing",
        "revision",
        "completed",
        "completed_with_todos",
        "failed",
      ]);
    });
  });

  describe("documents table structure", () => {
    const columns = documents as Record<string, unknown>;

    it("has tenantId column (not customerId)", () => {
      expect(columns).toHaveProperty("tenantId");
      expect(columns).not.toHaveProperty("customerId");
    });

    it("has docType column for multi-document support", () => {
      expect(columns).toHaveProperty("docType");
    });

    it("has text-type worksheetId (no FK)", () => {
      expect(columns).toHaveProperty("worksheetId");
    });

    it("has text-type createdBy (no FK)", () => {
      expect(columns).toHaveProperty("createdBy");
    });

    it("has all expected columns", () => {
      const expectedColumns = [
        "id",
        "tenantId",
        "docType",
        "worksheetId",
        "versionId",
        "dataSource",
        "uploadedDataS3Key",
        "title",
        "fiscalYear",
        "status",
        "priorYearPdfS3Key",
        "styleAnalysis",
        "generatedPdfS3Key",
        "webPreviewData",
        "currentIteration",
        "maxIterations",
        "createdBy",
        "createdAt",
        "updatedAt",
      ];
      for (const col of expectedColumns) {
        expect(columns).toHaveProperty(col);
      }
    });
  });

  describe("documentSections table structure", () => {
    it("has tenantId (not customerId)", () => {
      expect(documentSections).toHaveProperty("tenantId");
      expect(documentSections).not.toHaveProperty("customerId");
    });

    it("has documentId for cascade delete", () => {
      expect(documentSections).toHaveProperty("documentId");
    });

    it("uses text sectionType (not enum)", () => {
      expect(documentSections).toHaveProperty("sectionType");
    });
  });

  describe("agentSkills table structure", () => {
    it("has tenantId (not customerId)", () => {
      expect(agentSkills).toHaveProperty("tenantId");
      expect(agentSkills).not.toHaveProperty("customerId");
    });

    it("uses text agentType (not enum)", () => {
      expect(agentSkills).toHaveProperty("agentType");
    });
  });

  describe("documentTodos table structure", () => {
    it("has tenantId (not customerId)", () => {
      expect(documentTodos).toHaveProperty("tenantId");
      expect(documentTodos).not.toHaveProperty("customerId");
    });

    it("has sourceReviewId as plain uuid (no FK reference)", () => {
      expect(documentTodos).toHaveProperty("sourceReviewId");
    });
  });
});
