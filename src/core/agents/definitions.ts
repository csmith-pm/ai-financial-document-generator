/**
 * Re-export shim — agent definitions now live in doc-types/budget-book/agents.ts.
 * This file maintains backward compatibility for all existing imports.
 */

export {
  AGENT_TYPES,
  AGENT_DEFINITIONS,
  getAgentDefinition,
  type AgentType,
  type AgentDefinition,
} from "../../doc-types/budget-book/agents.js";
