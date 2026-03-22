import { describe, it, expect } from "vitest";
import {
  AGENT_TYPES,
  AGENT_DEFINITIONS,
  getAgentDefinition,
} from "../../src/doc-types/budget-book/agents.js";

describe("Budget Book Agent Definitions", () => {
  it("exports all 4 agent types", () => {
    expect(AGENT_TYPES).toHaveLength(4);
    expect(AGENT_TYPES).toContain("bb_creator");
    expect(AGENT_TYPES).toContain("bb_reviewer");
    expect(AGENT_TYPES).toContain("ada_reviewer");
    expect(AGENT_TYPES).toContain("bb_advisor");
  });

  it("exports AGENT_DEFINITIONS object with all agents", () => {
    expect(AGENT_DEFINITIONS).toBeDefined();
    expect(Object.keys(AGENT_DEFINITIONS)).toHaveLength(4);
  });

  describe("getAgentDefinition", () => {
    it("returns bb_creator definition", () => {
      const def = getAgentDefinition("bb_creator");
      expect(def).toBeDefined();
      expect(def.baseSystemPrompt).toBeTruthy();
      expect(def.temperature).toBe(0.4);
      expect(def.maxTokens).toBe(4096);
      expect(def.skillDomain).toBeDefined();
      expect(def.skillDomain.length).toBeGreaterThan(0);
    });

    it("returns bb_reviewer definition", () => {
      const def = getAgentDefinition("bb_reviewer");
      expect(def).toBeDefined();
      expect(def.baseSystemPrompt).toBeTruthy();
      expect(def.temperature).toBe(0.2);
      expect(def.maxTokens).toBe(4096);
    });

    it("returns ada_reviewer definition", () => {
      const def = getAgentDefinition("ada_reviewer");
      expect(def).toBeDefined();
      expect(def.baseSystemPrompt).toBeTruthy();
      expect(def.temperature).toBe(0.1);
    });

    it("returns bb_advisor definition", () => {
      const def = getAgentDefinition("bb_advisor");
      expect(def).toBeDefined();
      expect(def.baseSystemPrompt).toBeTruthy();
      expect(def.temperature).toBe(0.5);
      expect(def.maxTokens).toBe(2048);
    });

    it("each agent has a non-empty base system prompt", () => {
      for (const agentType of AGENT_TYPES) {
        const def = getAgentDefinition(agentType);
        expect(def.baseSystemPrompt.length).toBeGreaterThan(50);
      }
    });

    it("each agent has defined skill domains", () => {
      for (const agentType of AGENT_TYPES) {
        const def = getAgentDefinition(agentType);
        expect(Array.isArray(def.skillDomain)).toBe(true);
      }
    });

    it("each agent has a name and role", () => {
      for (const agentType of AGENT_TYPES) {
        const def = getAgentDefinition(agentType);
        expect(def.name).toBeTruthy();
        expect(def.role).toBeTruthy();
        expect(def.type).toBe(agentType);
      }
    });

    it("each agent has producesSkillsFor array", () => {
      for (const agentType of AGENT_TYPES) {
        const def = getAgentDefinition(agentType);
        expect(Array.isArray(def.producesSkillsFor)).toBe(true);
      }
    });
  });
});
