import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import {
  budgetBooks,
  budgetBookSections,
  budgetBookReviews,
  budgetBookJobs,
} from "../../db/schema.js";
import type { DrizzleInstance } from "../../db/connection.js";
import type { StorageProvider, QueueProvider } from "../../core/providers.js";
import {
  createBookSchema,
  bookIdParamSchema,
} from "../validation.js";

export interface BooksRouteDeps {
  db: DrizzleInstance;
  storage: StorageProvider;
  queue: QueueProvider;
}

export async function booksRoutes(
  app: FastifyInstance,
  deps: BooksRouteDeps
): Promise<void> {
  const { db, storage, queue } = deps;

  // POST /api/books — create a new budget book
  app.post("/api/books", async (request, reply) => {
    const body = createBookSchema.parse(request.body);
    const { tenantId, userId } = request.auth;

    const [book] = await db
      .insert(budgetBooks)
      .values({
        tenantId,
        title: body.title,
        fiscalYear: body.fiscalYear,
        dataSource: body.dataSource,
        worksheetId: body.worksheetId ?? null,
        versionId: body.versionId ?? null,
        maxIterations: body.maxIterations,
        createdBy: userId,
      })
      .returning();

    reply.status(201).send(book);
  });

  // GET /api/books — list books for the tenant
  app.get("/api/books", async (request, _reply) => {
    const { tenantId } = request.auth;
    const books = await db
      .select()
      .from(budgetBooks)
      .where(eq(budgetBooks.tenantId, tenantId))
      .orderBy(budgetBooks.createdAt);
    return books;
  });

  // GET /api/books/:id — get a single book
  app.get("/api/books/:id", async (request, reply) => {
    const { id } = bookIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const [book] = await db
      .select()
      .from(budgetBooks)
      .where(and(eq(budgetBooks.id, id), eq(budgetBooks.tenantId, tenantId)))
      .limit(1);

    if (!book) {
      reply.status(404).send({ error: "Book not found" });
      return;
    }
    return book;
  });

  // DELETE /api/books/:id
  app.delete("/api/books/:id", async (request, reply) => {
    const { id } = bookIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const deleted = await db
      .delete(budgetBooks)
      .where(and(eq(budgetBooks.id, id), eq(budgetBooks.tenantId, tenantId)))
      .returning({ id: budgetBooks.id });

    if (deleted.length === 0) {
      reply.status(404).send({ error: "Book not found" });
      return;
    }
    reply.status(204).send();
  });

  // POST /api/books/:id/budget-file — upload Excel budget file
  app.post("/api/books/:id/budget-file", async (request, reply) => {
    const { id } = bookIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const data = await request.file();
    if (!data) {
      reply.status(400).send({ error: "No file uploaded" });
      return;
    }

    const buffer = await data.toBuffer();
    const s3Key = `${tenantId}/budget-books/${id}/budget-file.xlsx`;
    await storage.upload(s3Key, buffer, data.mimetype);

    await db
      .update(budgetBooks)
      .set({
        uploadedBudgetS3Key: s3Key,
        dataSource: "upload",
        updatedAt: new Date(),
      })
      .where(and(eq(budgetBooks.id, id), eq(budgetBooks.tenantId, tenantId)));

    return { s3Key };
  });

  // POST /api/books/:id/prior-year-pdf — upload prior year PDF
  app.post("/api/books/:id/prior-year-pdf", async (request, reply) => {
    const { id } = bookIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const data = await request.file();
    if (!data) {
      reply.status(400).send({ error: "No file uploaded" });
      return;
    }

    const buffer = await data.toBuffer();
    const s3Key = `${tenantId}/budget-books/${id}/prior-year.pdf`;
    await storage.upload(s3Key, buffer, "application/pdf");

    await db
      .update(budgetBooks)
      .set({ priorYearPdfS3Key: s3Key, updatedAt: new Date() })
      .where(and(eq(budgetBooks.id, id), eq(budgetBooks.tenantId, tenantId)));

    return { s3Key };
  });

  // POST /api/books/:id/generate — start generation
  app.post("/api/books/:id/generate", async (request, reply) => {
    const { id } = bookIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const [book] = await db
      .select()
      .from(budgetBooks)
      .where(and(eq(budgetBooks.id, id), eq(budgetBooks.tenantId, tenantId)))
      .limit(1);

    if (!book) {
      reply.status(404).send({ error: "Book not found" });
      return;
    }

    if (book.status !== "draft" && book.status !== "failed") {
      reply
        .status(409)
        .send({ error: `Cannot generate from status "${book.status}"` });
      return;
    }

    // Create job tracking rows
    const jobTypes = [
      "analyze_prior_pdf",
      "generate_sections",
      "render_charts",
      "gfoa_review",
      "ada_review",
      "revise_sections",
      "render_pdf",
      "finalize",
    ] as const;

    for (const jobType of jobTypes) {
      await db.insert(budgetBookJobs).values({
        budgetBookId: id,
        tenantId,
        jobType,
        status: "pending",
        progress: 0,
      });
    }

    // Enqueue generation job
    await queue.enqueue("generate-budget-book", {
      budgetBookId: id,
      tenantId,
    });

    reply.status(202).send({ message: "Generation started", budgetBookId: id });
  });

  // POST /api/books/:id/regenerate — regenerate after addressing todos
  app.post("/api/books/:id/regenerate", async (request, reply) => {
    const { id } = bookIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const [book] = await db
      .select()
      .from(budgetBooks)
      .where(and(eq(budgetBooks.id, id), eq(budgetBooks.tenantId, tenantId)))
      .limit(1);

    if (!book) {
      reply.status(404).send({ error: "Book not found" });
      return;
    }

    if (
      book.status !== "completed" &&
      book.status !== "completed_with_todos" &&
      book.status !== "failed"
    ) {
      reply
        .status(409)
        .send({ error: `Cannot regenerate from status "${book.status}"` });
      return;
    }

    await queue.enqueue("regenerate-budget-book", {
      budgetBookId: id,
      tenantId,
    });

    reply.status(202).send({ message: "Regeneration started", budgetBookId: id });
  });

  // GET /api/books/:id/progress — get job progress
  app.get("/api/books/:id/progress", async (request, reply) => {
    const { id } = bookIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const [book] = await db
      .select({ id: budgetBooks.id })
      .from(budgetBooks)
      .where(and(eq(budgetBooks.id, id), eq(budgetBooks.tenantId, tenantId)))
      .limit(1);

    if (!book) {
      reply.status(404).send({ error: "Book not found" });
      return;
    }

    const jobs = await db
      .select()
      .from(budgetBookJobs)
      .where(eq(budgetBookJobs.budgetBookId, id))
      .orderBy(budgetBookJobs.createdAt);

    return { budgetBookId: id, jobs };
  });

  // GET /api/books/:id/preview — get web preview data
  app.get("/api/books/:id/preview", async (request, reply) => {
    const { id } = bookIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const [book] = await db
      .select({
        id: budgetBooks.id,
        webPreviewData: budgetBooks.webPreviewData,
        status: budgetBooks.status,
      })
      .from(budgetBooks)
      .where(and(eq(budgetBooks.id, id), eq(budgetBooks.tenantId, tenantId)))
      .limit(1);

    if (!book) {
      reply.status(404).send({ error: "Book not found" });
      return;
    }

    const sections = await db
      .select()
      .from(budgetBookSections)
      .where(eq(budgetBookSections.budgetBookId, id))
      .orderBy(budgetBookSections.sectionOrder);

    return { book, sections };
  });

  // GET /api/books/:id/pdf — download generated PDF
  app.get("/api/books/:id/pdf", async (request, reply) => {
    const { id } = bookIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const [book] = await db
      .select({
        generatedPdfS3Key: budgetBooks.generatedPdfS3Key,
      })
      .from(budgetBooks)
      .where(and(eq(budgetBooks.id, id), eq(budgetBooks.tenantId, tenantId)))
      .limit(1);

    if (!book) {
      reply.status(404).send({ error: "Book not found" });
      return;
    }

    if (!book.generatedPdfS3Key) {
      reply.status(404).send({ error: "PDF not yet generated" });
      return;
    }

    const url = await storage.getSignedUrl(book.generatedPdfS3Key, 3600);
    reply.redirect(url);
  });

  // GET /api/books/:id/reviews — get reviews for a book
  app.get("/api/books/:id/reviews", async (request, reply) => {
    const { id } = bookIdParamSchema.parse(request.params);
    const { tenantId } = request.auth;

    const [book] = await db
      .select({ id: budgetBooks.id })
      .from(budgetBooks)
      .where(and(eq(budgetBooks.id, id), eq(budgetBooks.tenantId, tenantId)))
      .limit(1);

    if (!book) {
      reply.status(404).send({ error: "Book not found" });
      return;
    }

    const reviews = await db
      .select()
      .from(budgetBookReviews)
      .where(eq(budgetBookReviews.budgetBookId, id))
      .orderBy(budgetBookReviews.createdAt);

    return { budgetBookId: id, reviews };
  });
}
