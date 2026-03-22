/**
 * Todo Advisor — handles conversational chat on todo items.
 *
 * Loads the todo context, prior messages, and builds a prompt
 * with the doc type's advisor agent definition + accumulated skills.
 */

import { eq, asc } from "drizzle-orm";
import { documentTodos, documentTodoMessages, documents } from "../../db/schema.js";
import type { DrizzleInstance } from "../../db/connection.js";
import type { AiProvider } from "../providers.js";
import { buildAgentPrompt } from "../agents/promptBuilder.js";
import { defaultRegistry } from "../doc-type-registry.js";

const MAX_HISTORY_MESSAGES = 20;

/**
 * Handle a user message on a todo item. Returns the agent's response text.
 */
export async function handleTodoChat(
  db: DrizzleInstance,
  ai: AiProvider,
  tenantId: string,
  todoId: string,
  userMessage: string
): Promise<string> {
  // Load the todo and its document for context
  const [todo] = await db
    .select()
    .from(documentTodos)
    .where(eq(documentTodos.id, todoId))
    .limit(1);

  if (!todo) {
    throw new Error(`Todo ${todoId} not found`);
  }

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, todo.documentId))
    .limit(1);

  // Resolve the doc type to get the advisor agent
  const docType = defaultRegistry.get(doc?.docType ?? "budget_book");
  const advisorAgent = docType.getAgent(docType.advisorAgentType);

  // Load prior conversation messages (most recent N)
  const priorMessages = await db
    .select()
    .from(documentTodoMessages)
    .where(eq(documentTodoMessages.todoId, todoId))
    .orderBy(asc(documentTodoMessages.createdAt))
    .limit(MAX_HISTORY_MESSAGES);

  // Save the user message
  await db.insert(documentTodoMessages).values({
    todoId,
    role: "user",
    content: userMessage,
  });

  // Update todo status to in_progress if still open
  if (todo.status === "open") {
    await db
      .update(documentTodos)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(documentTodos.id, todoId));
  }

  // Build system prompt with skills
  const systemPrompt = await buildAgentPrompt(
    db,
    docType.advisorAgentType,
    tenantId,
    advisorAgent.baseSystemPrompt
  );

  // Build context-enriched user prompt
  const todoContext = [
    `## Current Action Item`,
    `**Title:** ${todo.title}`,
    `**Category:** ${todo.category}`,
    `**Priority:** ${todo.priority}`,
    todo.sectionType ? `**Section:** ${todo.sectionType}` : null,
    `**Description:** ${todo.description}`,
    doc ? `\n## Document Context\n**Title:** ${doc.title}\n**Fiscal Year:** FY${doc.fiscalYear}\n**Type:** ${doc.docType}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Build conversation as a single user turn with history
  const historyLines = priorMessages.map((m: { role: string; content: string }) =>
    `[${m.role === "agent" ? advisorAgent.name : "User"}]: ${m.content}`
  );

  const fullUserPrompt = `${todoContext}

## Conversation History
${historyLines.length > 0 ? historyLines.join("\n\n") : "(No prior messages)"}

## New Message from User
${userMessage}

Respond helpfully and concisely. If the user has provided enough information to resolve this action item, mention that they can mark it as resolved.`;

  const result = await ai.callText(systemPrompt, fullUserPrompt, {
    maxTokens: advisorAgent.maxTokens,
    temperature: advisorAgent.temperature,
  });

  await ai.logUsage?.(
    tenantId,
    `${docType.advisorAgentType}_chat`,
    result.inputTokens,
    result.outputTokens,
    result.model
  );

  // Save agent response
  await db.insert(documentTodoMessages).values({
    todoId,
    role: "agent",
    content: result.text,
  });

  return result.text;
}
