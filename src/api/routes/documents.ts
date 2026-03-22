/**
 * Generic document routes — work with any registered document type.
 *
 * All endpoints use `/api/documents` prefix. The doc type is resolved from
 * the document record's `docType` field. S3 paths use the doc type's
 * `storagePrefix` for proper namespacing.
 *
 * The `/api/books` routes in books.ts are kept as backward-compatible aliases
 * that delegate to these same DB operations.
 */

import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import {
  documents,
  documentSections,
  documentReviews,
  documentJobs,
  documentTodos,
  documentTodoMessages,
} from "../../db/schema.js";
import type { DrizzleInstance } from "../../db/connection.js";
import type {
  AiProvider,
  StorageProvider,
  QueueProvider,
} from "../../core/providers.js";
import { defaultRegistry } from "../../core/doc-type-registry.js";
import {
  createDocumentSchema,
  documentIdParamSchema,
  documentIdWithTodoParamSchema,
  todoIdParamSchema,
  sendMessageSchema,
  updateTodoStatusSchema,
} from "../validation.js";
import { handleTodoChat } from "../../core/todos/advisor.js";

export interface DocumentRouteDeps {
  db: DrizzleInstance;
  ai: AiProvider;
  storage: StorageProvider;
  queue: QueueProvider;
}

export async function documentRoutes(
  app: FastifyInstance,
  deps: DocumentRouteDeps
): Promise<void> {
  const { db, ai, storage, queue } = deps;

  // ─── Document CRUD ──────────────────────────────────────────────────

  // POST /api/documents — create a new document
  app.post("/api/documents", async (request, reply) => {
    const body = createDocumentSchema.parse(request.body);
    const { tenantId, userId } = request.auth;

    // Validate doc type is registered
    if (!defaultRegistry.has(body.docType)) {
      reply.status(400).send({ error: `Unknown document type: "${body.docType}"` });
      return;
    }

    const [doc] = await db
      .insert(documents)
      .values({
        tenantId,
        docType: body.docType,
        title: body.title,
        fiscalYear: body.fiscalYear,
        dataSource: body.dataSource,
        worksheetId: body.worksheetId ?? null,
        versionId: body.versionId ?? null,
        maxIterations: body.maxIterations,
        createdBy: userId,
      })
      .returning();

    reply.status(201).send(doc);
  });

  // GET /api/documents — list documents for the tenant
  app.get("/api/documents", async (request, _reply) => {
    const { tenantId } = request.auth;
    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.tenantId, tenantId))
      .orderBy(documents.createdAt);
    return docs;
  });

  // GET /api/documents/:id — get a single document
  app.get("/api/documents/:id", async (request, reply) => {
    const { id } = documentIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)))
      .limit(1);

    if (!doc) {
      reply.status(404).send({ error: "Document not found" });
      return;
    }
    return doc;
  });

  // DELETE /api/documents/:id
  app.delete("/api/documents/:id", async (request, reply) => {
    const { id } = documentIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const deleted = await db
      .delete(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)))
      .returning({ id: documents.id });

    if (deleted.length === 0) {
      reply.status(404).send({ error: "Document not found" });
      return;
    }
    reply.status(204).send();
  });

  // ─── File Uploads ───────────────────────────────────────────────────

  // POST /api/documents/:id/data-file — upload data file (Excel, etc.)
  app.post("/api/documents/:id/data-file", async (request, reply) => {
    const { id } = documentIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const [doc] = await db
      .select({ id: documents.id, docType: documents.docType })
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)))
      .limit(1);

    if (!doc) {
      reply.status(404).send({ error: "Document not found" });
      return;
    }

    const data = await request.file();
    if (!data) {
      reply.status(400).send({ error: "No file uploaded" });
      return;
    }

    const docType = defaultRegistry.get(doc.docType!);
    const buffer = await data.toBuffer();
    const s3Key = `${tenantId}/${docType.storagePrefix}/${id}/data-file${getExtension(data.filename)}`;
    await storage.upload(s3Key, buffer, data.mimetype);

    await db
      .update(documents)
      .set({
        uploadedDataS3Key: s3Key,
        dataSource: "upload",
        updatedAt: new Date(),
      })
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)));

    return { s3Key };
  });

  // POST /api/documents/:id/prior-document — upload prior year document
  app.post("/api/documents/:id/prior-document", async (request, reply) => {
    const { id } = documentIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const [doc] = await db
      .select({ id: documents.id, docType: documents.docType })
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)))
      .limit(1);

    if (!doc) {
      reply.status(404).send({ error: "Document not found" });
      return;
    }

    const data = await request.file();
    if (!data) {
      reply.status(400).send({ error: "No file uploaded" });
      return;
    }

    const docType = defaultRegistry.get(doc.docType!);
    const buffer = await data.toBuffer();
    const s3Key = `${tenantId}/${docType.storagePrefix}/${id}/prior-document.pdf`;
    await storage.upload(s3Key, buffer, "application/pdf");

    await db
      .update(documents)
      .set({ priorYearPdfS3Key: s3Key, updatedAt: new Date() })
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)));

    return { s3Key };
  });

  // ─── Generation ─────────────────────────────────────────────────────

  // POST /api/documents/:id/generate — start generation
  app.post("/api/documents/:id/generate", async (request, reply) => {
    const { id } = documentIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)))
      .limit(1);

    if (!doc) {
      reply.status(404).send({ error: "Document not found" });
      return;
    }

    if (doc.status !== "draft" && doc.status !== "failed") {
      reply
        .status(409)
        .send({ error: `Cannot generate from status "${doc.status}"` });
      return;
    }

    // Create job tracking rows from the pipeline steps
    const { buildDefaultPipeline } = await import("../../core/pipeline/index.js");
    const pipeline = buildDefaultPipeline();
    for (const step of pipeline) {
      await db.insert(documentJobs).values({
        documentId: id,
        tenantId,
        jobType: step.id,
        status: "pending",
        progress: 0,
      });
    }

    // Enqueue generation job
    await queue.enqueue("generate-document", {
      documentId: id,
      tenantId,
    });

    reply.status(202).send({ message: "Generation started", documentId: id });
  });

  // POST /api/documents/:id/regenerate — regenerate after addressing todos
  app.post("/api/documents/:id/regenerate", async (request, reply) => {
    const { id } = documentIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)))
      .limit(1);

    if (!doc) {
      reply.status(404).send({ error: "Document not found" });
      return;
    }

    if (
      doc.status !== "completed" &&
      doc.status !== "completed_with_todos" &&
      doc.status !== "failed"
    ) {
      reply
        .status(409)
        .send({ error: `Cannot regenerate from status "${doc.status}"` });
      return;
    }

    await queue.enqueue("regenerate-document", {
      documentId: id,
      tenantId,
    });

    reply
      .status(202)
      .send({ message: "Regeneration started", documentId: id });
  });

  // ─── Progress & Preview ─────────────────────────────────────────────

  // GET /api/documents/:id/progress — get job progress
  app.get("/api/documents/:id/progress", async (request, reply) => {
    const { id } = documentIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const [doc] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)))
      .limit(1);

    if (!doc) {
      reply.status(404).send({ error: "Document not found" });
      return;
    }

    const jobs = await db
      .select()
      .from(documentJobs)
      .where(eq(documentJobs.documentId, id))
      .orderBy(documentJobs.createdAt);

    return { documentId: id, jobs };
  });

  // GET /api/documents/:id/preview — get web preview data
  app.get("/api/documents/:id/preview", async (request, reply) => {
    const { id } = documentIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const [doc] = await db
      .select({
        id: documents.id,
        webPreviewData: documents.webPreviewData,
        status: documents.status,
      })
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)))
      .limit(1);

    if (!doc) {
      reply.status(404).send({ error: "Document not found" });
      return;
    }

    const sections = await db
      .select()
      .from(documentSections)
      .where(eq(documentSections.documentId, id))
      .orderBy(documentSections.sectionOrder);

    return { document: doc, sections };
  });

  // GET /api/documents/:id/pdf — download generated PDF
  app.get("/api/documents/:id/pdf", async (request, reply) => {
    const { id } = documentIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const [doc] = await db
      .select({
        generatedPdfS3Key: documents.generatedPdfS3Key,
      })
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)))
      .limit(1);

    if (!doc) {
      reply.status(404).send({ error: "Document not found" });
      return;
    }

    if (!doc.generatedPdfS3Key) {
      reply.status(404).send({ error: "PDF not yet generated" });
      return;
    }

    const url = await storage.getSignedUrl(doc.generatedPdfS3Key, 3600);
    reply.redirect(url);
  });

  // GET /api/documents/:id/reviews — get reviews for a document
  app.get("/api/documents/:id/reviews", async (request, reply) => {
    const { id } = documentIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const [doc] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)))
      .limit(1);

    if (!doc) {
      reply.status(404).send({ error: "Document not found" });
      return;
    }

    const reviews = await db
      .select()
      .from(documentReviews)
      .where(eq(documentReviews.documentId, id))
      .orderBy(documentReviews.createdAt);

    return { documentId: id, reviews };
  });

  // ─── Todos (nested under documents) ─────────────────────────────────

  // GET /api/documents/:documentId/todos — list todos for a document
  app.get("/api/documents/:documentId/todos", async (request, reply) => {
    const { documentId } = documentIdWithTodoParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const [doc] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(eq(documents.id, documentId), eq(documents.tenantId, tenantId))
      )
      .limit(1);

    if (!doc) {
      reply.status(404).send({ error: "Document not found" });
      return;
    }

    const todos = await db
      .select()
      .from(documentTodos)
      .where(eq(documentTodos.documentId, documentId))
      .orderBy(documentTodos.createdAt);

    return { documentId, todos };
  });

  // GET /api/documents/todos/:id — get a todo with its messages
  app.get("/api/documents/todos/:id", async (request, reply) => {
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

  // POST /api/documents/todos/:id/messages — send a message to the advisor
  app.post("/api/documents/todos/:id/messages", async (request, reply) => {
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

  // POST /api/documents/todos/:id/files — upload a file attachment
  app.post("/api/documents/todos/:id/files", async (request, reply) => {
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

  // PATCH /api/documents/todos/:id/status — update todo status
  app.patch("/api/documents/todos/:id/status", async (request, reply) => {
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

// ─── Helpers ────────────────────────────────────────────────────────────

/** Extract file extension from filename, or default to empty string */
function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot) : "";
}
