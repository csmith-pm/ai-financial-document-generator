import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import {
  documents,
  documentTodos,
  documentTodoMessages,
} from "../../db/schema.js";
import type { DrizzleInstance } from "../../db/connection.js";
import type { AiProvider, StorageProvider } from "../../core/providers.js";
import {
  bookIdWithTodoParamSchema,
  todoIdParamSchema,
  sendMessageSchema,
  updateTodoStatusSchema,
} from "../validation.js";
import { handleTodoChat } from "../../core/todos/advisor.js";

export interface TodosRouteDeps {
  db: DrizzleInstance;
  ai: AiProvider;
  storage: StorageProvider;
}

export async function todosRoutes(
  app: FastifyInstance,
  deps: TodosRouteDeps
): Promise<void> {
  const { db, ai, storage } = deps;

  // GET /api/books/:bookId/todos — list todos for a book
  app.get("/api/books/:bookId/todos", async (request, reply) => {
    const { bookId } = bookIdWithTodoParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    // Verify book belongs to tenant
    const [book] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.id, bookId), eq(documents.tenantId, tenantId)))
      .limit(1);

    if (!book) {
      reply.status(404).send({ error: "Book not found" });
      return;
    }

    const todos = await db
      .select()
      .from(documentTodos)
      .where(eq(documentTodos.documentId, bookId))
      .orderBy(documentTodos.createdAt);

    return { bookId, todos };
  });

  // GET /api/todos/:id — get a todo with its messages
  app.get("/api/todos/:id", async (request, reply) => {
    const { id } = todoIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const [todo] = await db
      .select()
      .from(documentTodos)
      .where(
        and(eq(documentTodos.id, id), eq(documentTodos.tenantId, tenantId))
      )
      .limit(1);

    if (!todo) {
      reply.status(404).send({ error: "Todo not found" });
      return;
    }

    const messages = await db
      .select()
      .from(documentTodoMessages)
      .where(eq(documentTodoMessages.todoId, id))
      .orderBy(documentTodoMessages.createdAt);

    return { todo, messages };
  });

  // POST /api/todos/:id/messages — send a message to the todo advisor
  app.post("/api/todos/:id/messages", async (request, reply) => {
    const { id } = todoIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;
    const { message } = sendMessageSchema.parse(request.body);

    const [todo] = await db
      .select()
      .from(documentTodos)
      .where(
        and(eq(documentTodos.id, id), eq(documentTodos.tenantId, tenantId))
      )
      .limit(1);

    if (!todo) {
      reply.status(404).send({ error: "Todo not found" });
      return;
    }

    const response = await handleTodoChat(db, ai, tenantId, id, message);
    return response;
  });

  // POST /api/todos/:id/files — upload a file attachment to a todo
  app.post("/api/todos/:id/files", async (request, reply) => {
    const { id } = todoIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const [todo] = await db
      .select()
      .from(documentTodos)
      .where(
        and(eq(documentTodos.id, id), eq(documentTodos.tenantId, tenantId))
      )
      .limit(1);

    if (!todo) {
      reply.status(404).send({ error: "Todo not found" });
      return;
    }

    const data = await request.file();
    if (!data) {
      reply.status(400).send({ error: "No file uploaded" });
      return;
    }

    const buffer = await data.toBuffer();
    const s3Key = `${tenantId}/todos/${id}/${data.filename}`;
    await storage.upload(s3Key, buffer, data.mimetype);

    return { s3Key };
  });

  // PATCH /api/todos/:id/status — update todo status
  app.patch("/api/todos/:id/status", async (request, reply) => {
    const { id } = todoIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;
    const { status } = updateTodoStatusSchema.parse(request.body);

    const [todo] = await db
      .select()
      .from(documentTodos)
      .where(
        and(eq(documentTodos.id, id), eq(documentTodos.tenantId, tenantId))
      )
      .limit(1);

    if (!todo) {
      reply.status(404).send({ error: "Todo not found" });
      return;
    }

    const [updated] = await db
      .update(documentTodos)
      .set({ status, updatedAt: new Date() })
      .where(eq(documentTodos.id, id))
      .returning();

    return updated;
  });
}
