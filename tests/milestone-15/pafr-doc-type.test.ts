import { describe, it, expect } from "vitest";
import { pafrDocType } from "../../src/doc-types/pafr/index.js";
import { defaultRegistry } from "../../src/doc-types/index.js";
import type { PafrData } from "../../src/doc-types/pafr/data-types.js";

/** Minimal valid PafrData for schema testing. */
const VALID_DATA: PafrData = {
  fiscalYear: 2026,
  communityProfile: {
    name: "Springfield",
    state: "IL",
    population: 115000,
    squareMiles: 60,
    formOfGovernment: "Council-Manager",
  },
  totalRevenue: 48_000_000,
  totalExpenditure: 45_000_000,
  revenueBySource: [
    { source: "Property Tax", amount: 20_000_000, pctOfTotal: 41.7 },
    { source: "Sales Tax", amount: 15_000_000, pctOfTotal: 31.3 },
  ],
  expenditureByFunction: [
    { function: "Public Safety", amount: 18_000_000, pctOfTotal: 40.0 },
    { function: "Infrastructure", amount: 12_000_000, pctOfTotal: 26.7 },
  ],
  keyMetrics: [
    { label: "Bond Rating", value: "Aa2", trend: "flat" },
  ],
  demographicHighlights: [
    { metric: "Population Growth", value: "1.2%", source: "US Census" },
  ],
  fundBalance: { beginning: 10_000_000, ending: 13_000_000, change: 3_000_000 },
  leadershipMessage: "Dear residents, it was a great year.",
};

/** Data with gaps for detector testing. */
const EMPTY_DATA: PafrData = {
  fiscalYear: 2026,
  communityProfile: {
    name: "Municipality",
    state: "",
    population: 0,
    squareMiles: 0,
    formOfGovernment: "",
  },
  totalRevenue: 0,
  totalExpenditure: 0,
  revenueBySource: [],
  expenditureByFunction: [],
  keyMetrics: [],
  demographicHighlights: [],
  fundBalance: { beginning: 0, ending: 0, change: 0 },
};

describe("PafrDocType", () => {
  it("has correct identity", () => {
    expect(pafrDocType.id).toBe("pafr");
    expect(pafrDocType.name).toBe("Popular Annual Financial Report");
    expect(pafrDocType.version).toBe("1.0.0");
  });

  it("is registered in the default registry", () => {
    expect(defaultRegistry.has("pafr")).toBe(true);
    expect(defaultRegistry.get("pafr")).toBe(pafrDocType);
  });

  it("registry has both budget_book and pafr", () => {
    expect(defaultRegistry.has("budget_book")).toBe(true);
    expect(defaultRegistry.has("pafr")).toBe(true);
    const all = defaultRegistry.list();
    expect(all).toHaveLength(2);
  });

  it("has 5 section types in correct order", () => {
    expect(pafrDocType.sectionTypes).toHaveLength(5);
    const ids = pafrDocType.sectionTypes.map((s) => s.id);
    expect(ids).toEqual([
      "letter_from_leadership",
      "financial_highlights",
      "revenue_overview",
      "expenditure_overview",
      "demographic_profile",
    ]);
  });

  it("sections have correct parallel/structural flags", () => {
    const specs = pafrDocType.sectionTypes;
    const leadership = specs.find((s) => s.id === "letter_from_leadership")!;
    expect(leadership.structural).toBe(true);
    expect(leadership.parallel).toBe(false);

    const revenue = specs.find((s) => s.id === "revenue_overview")!;
    expect(revenue.parallel).toBe(true);
    expect(revenue.structural).toBe(false);
  });

  it("has 4 agents", () => {
    expect(pafrDocType.agents).toHaveLength(4);
    const types = pafrDocType.agents.map((a) => a.type);
    expect(types).toContain("pafr_creator");
    expect(types).toContain("pafr_reviewer");
    expect(types).toContain("ada_reviewer");
    expect(types).toContain("pafr_advisor");
  });

  it("getAgent returns correct definition", () => {
    const creator = pafrDocType.getAgent("pafr_creator");
    expect(creator.name).toBe("PAFR_Creator");
    expect(creator.temperature).toBe(0.5);
    expect(creator.maxTokens).toBe(4096);
  });

  it("getAgent throws on unknown type", () => {
    expect(() => pafrDocType.getAgent("unknown")).toThrow(
      'Unknown PAFR agent type: "unknown"'
    );
  });

  it("has 2 reviewers", () => {
    expect(pafrDocType.reviewers).toHaveLength(2);
    expect(pafrDocType.reviewers[0].id).toBe("pafr_quality");
    expect(pafrDocType.reviewers[1].id).toBe("ada");
  });

  it("has 10 seed skills", () => {
    expect(pafrDocType.seedSkills).toHaveLength(10);
    const agentTypes = [...new Set(pafrDocType.seedSkills.map((s) => s.agentType))];
    expect(agentTypes).toContain("pafr_creator");
    expect(agentTypes).toContain("pafr_reviewer");
  });

  it("has category priorities", () => {
    expect(pafrDocType.categoryPriority.accessibility).toBe(30);
    expect(pafrDocType.categoryPriority.plain_language).toBe(25);
    expect(pafrDocType.categoryPriority.review_criteria).toBe(20);
    expect(pafrDocType.categoryPriority.visual_design).toBe(15);
    expect(pafrDocType.categoryPriority.advisory).toBe(5);
  });

  it("creatorAgentType is pafr_creator", () => {
    expect(pafrDocType.creatorAgentType).toBe("pafr_creator");
  });

  it("advisorAgentType is pafr_advisor", () => {
    expect(pafrDocType.advisorAgentType).toBe("pafr_advisor");
  });

  it("storagePrefix is pafr", () => {
    expect(pafrDocType.storagePrefix).toBe("pafr");
  });

  it("dataSchema validates valid PafrData", () => {
    const result = pafrDocType.dataSchema.safeParse(VALID_DATA);
    expect(result.success).toBe(true);
  });

  it("dataSchema rejects invalid data", () => {
    const result = pafrDocType.dataSchema.safeParse({
      fiscalYear: "not a number",
    });
    expect(result.success).toBe(false);
  });

  it("dataSchema validates optional leadershipMessage", () => {
    const withoutMessage = { ...VALID_DATA };
    delete (withoutMessage as Record<string, unknown>).leadershipMessage;
    const result = pafrDocType.dataSchema.safeParse(withoutMessage);
    expect(result.success).toBe(true);
  });

  it("detectDataGaps finds gaps in empty data", () => {
    const gaps = pafrDocType.detectDataGaps(EMPTY_DATA);
    expect(gaps.length).toBeGreaterThanOrEqual(5);
    const titles = gaps.map((g) => g.title);
    expect(titles).toContain("No revenue breakdown available");
    expect(titles).toContain("No expenditure breakdown available");
    expect(titles).toContain("No fund balance data");
    expect(titles).toContain("Community profile not configured");
    expect(titles).toContain("No demographic highlights");
    expect(titles).toContain("No key metrics defined");
  });

  it("detectDataGaps finds leadership gap when no message", () => {
    const gaps = pafrDocType.detectDataGaps(EMPTY_DATA);
    const titles = gaps.map((g) => g.title);
    expect(titles).toContain("No leadership message provided");
  });

  it("detectDataGaps returns no gaps for complete data", () => {
    const gaps = pafrDocType.detectDataGaps(VALID_DATA);
    expect(gaps).toHaveLength(0);
  });

  it("getSectionData returns relevant slice for revenue", () => {
    const data = pafrDocType.getSectionData("revenue_overview", VALID_DATA);
    expect(data).toHaveProperty("revenueBySource");
    expect(data).toHaveProperty("totalRevenue");
    expect(data).toHaveProperty("fiscalYear");
    expect(data).not.toHaveProperty("expenditureByFunction");
  });

  it("getSectionData returns relevant slice for demographics", () => {
    const data = pafrDocType.getSectionData("demographic_profile", VALID_DATA);
    expect(data).toHaveProperty("communityProfile");
    expect(data).toHaveProperty("demographicHighlights");
    expect(data).not.toHaveProperty("revenueBySource");
  });

  it("getSectionPrompt returns non-empty string with section type", () => {
    const prompt = pafrDocType.getSectionPrompt("financial_highlights", VALID_DATA, null);
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain("financial_highlights");
    expect(prompt).toContain("Springfield");
    expect(prompt).toContain("citizen-facing");
  });

  it("getSectionPrompt includes style guidance when provided", () => {
    const style = {
      narrativeTone: "warm and conversational",
      chartTypes: ["pie", "bar"],
      overallStyle: "modern infographic",
      headingPatterns: [],
      colorPalette: [],
    };
    const prompt = pafrDocType.getSectionPrompt("revenue_overview", VALID_DATA, style);
    expect(prompt).toContain("warm and conversational");
    expect(prompt).toContain("pie");
  });

  it("buildRevisionPrompt returns system suffix and user prompt", () => {
    const section = {
      sectionType: "revenue_overview",
      title: "Revenue Overview",
      narrativeContent: "Revenue totaled $48M.",
      tableData: [],
      chartConfigs: [],
    };
    const feedback = new Map([
      ["pafr_quality", ["[high] Needs more context"]],
      ["ada", ["[critical] Missing alt text"]],
    ]);
    const result = pafrDocType.buildRevisionPrompt!(section, feedback, VALID_DATA, null);
    expect(result.systemPromptSuffix).toContain("revising an existing PAFR section");
    expect(result.userPrompt).toContain("Needs more context");
    expect(result.userPrompt).toContain("Missing alt text");
  });

  it("shouldContinueIterating stops when all pass", () => {
    const results = new Map([
      ["pafr_quality", { passed: true, score: 80 }],
      ["ada", { passed: true, score: null }],
    ]);
    expect(pafrDocType.shouldContinueIterating!(results, 1, new Map())).toBe(false);
  });

  it("shouldContinueIterating detects plateau", () => {
    const results = new Map([
      ["pafr_quality", { passed: false, score: 55 }],
      ["ada", { passed: true, score: null }],
    ]);
    const prev = new Map<string, number | null>([["pafr_quality", 55]]);
    expect(pafrDocType.shouldContinueIterating!(results, 2, prev)).toBe(false);
  });

  it("shouldContinueIterating continues when score improving", () => {
    const results = new Map([
      ["pafr_quality", { passed: false, score: 55 }],
      ["ada", { passed: true, score: null }],
    ]);
    const prev = new Map<string, number | null>([["pafr_quality", 45]]);
    expect(pafrDocType.shouldContinueIterating!(results, 2, prev)).toBe(true);
  });

  it("has extractSkillsFromReview method", () => {
    expect(typeof pafrDocType.extractSkillsFromReview).toBe("function");
  });

  it("has createTodosFromReview method", () => {
    expect(typeof pafrDocType.createTodosFromReview).toBe("function");
  });
});
