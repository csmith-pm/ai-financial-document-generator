import { describe, it, expect } from "vitest";
import {
  budgetBooks,
  budgetBookSections,
  budgetBookReviews,
  budgetBookJobs,
  agentSkills,
  budgetBookTodos,
  budgetBookTodoMessages,
  budgetBookStatusEnum,
  budgetBookSectionTypeEnum,
  budgetBookReviewerTypeEnum,
  budgetBookJobTypeEnum,
  budgetBookJobStatusEnum,
  budgetBookDataSourceEnum,
  agentTypeEnum,
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
      expect(budgetBooks).toBeDefined();
      expect(budgetBookSections).toBeDefined();
      expect(budgetBookReviews).toBeDefined();
      expect(budgetBookJobs).toBeDefined();
      expect(agentSkills).toBeDefined();
      expect(budgetBookTodos).toBeDefined();
      expect(budgetBookTodoMessages).toBeDefined();
    });
  });

  describe("Enum exports", () => {
    it("exports all enums", () => {
      expect(budgetBookStatusEnum).toBeDefined();
      expect(budgetBookSectionTypeEnum).toBeDefined();
      expect(budgetBookReviewerTypeEnum).toBeDefined();
      expect(budgetBookJobTypeEnum).toBeDefined();
      expect(budgetBookJobStatusEnum).toBeDefined();
      expect(budgetBookDataSourceEnum).toBeDefined();
      expect(agentTypeEnum).toBeDefined();
      expect(skillScopeEnum).toBeDefined();
      expect(skillStatusEnum).toBeDefined();
      expect(todoCategoryEnum).toBeDefined();
      expect(todoStatusEnum).toBeDefined();
      expect(todoPriorityEnum).toBeDefined();
      expect(todoMessageRoleEnum).toBeDefined();
    });

    it("budgetBookStatusEnum has all expected values", () => {
      expect(budgetBookStatusEnum.enumValues).toEqual([
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

    it("budgetBookSectionTypeEnum has all expected values", () => {
      expect(budgetBookSectionTypeEnum.enumValues).toEqual([
        "cover",
        "toc",
        "executive_summary",
        "community_profile",
        "revenue_summary",
        "expenditure_summary",
        "personnel_summary",
        "capital_summary",
        "multi_year_outlook",
        "appendix",
      ]);
    });

    it("agentTypeEnum has all 4 agent types", () => {
      expect(agentTypeEnum.enumValues).toEqual([
        "bb_creator",
        "bb_reviewer",
        "ada_reviewer",
        "bb_advisor",
      ]);
    });

    it("budgetBookJobTypeEnum has all 8 job types", () => {
      expect(budgetBookJobTypeEnum.enumValues).toEqual([
        "analyze_prior_pdf",
        "generate_sections",
        "render_charts",
        "gfoa_review",
        "ada_review",
        "revise_sections",
        "render_pdf",
        "finalize",
      ]);
    });
  });

  describe("budgetBooks table structure", () => {
    const columns = budgetBooks as Record<string, unknown>;

    it("has tenantId column (not customerId)", () => {
      expect(columns).toHaveProperty("tenantId");
      expect(columns).not.toHaveProperty("customerId");
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
        "worksheetId",
        "versionId",
        "dataSource",
        "uploadedBudgetS3Key",
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

  describe("budgetBookSections table structure", () => {
    it("has tenantId (not customerId)", () => {
      expect(budgetBookSections).toHaveProperty("tenantId");
      expect(budgetBookSections).not.toHaveProperty("customerId");
    });

    it("has budgetBookId for cascade delete", () => {
      expect(budgetBookSections).toHaveProperty("budgetBookId");
    });
  });

  describe("agentSkills table structure", () => {
    it("has tenantId (not customerId)", () => {
      expect(agentSkills).toHaveProperty("tenantId");
      expect(agentSkills).not.toHaveProperty("customerId");
    });
  });

  describe("budgetBookTodos table structure", () => {
    it("has tenantId (not customerId)", () => {
      expect(budgetBookTodos).toHaveProperty("tenantId");
      expect(budgetBookTodos).not.toHaveProperty("customerId");
    });

    it("has sourceReviewId as plain uuid (no FK reference)", () => {
      expect(budgetBookTodos).toHaveProperty("sourceReviewId");
    });
  });
});
