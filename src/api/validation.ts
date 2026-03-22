import { z } from "zod";

// ---- Documents (generic) ----

export const createDocumentSchema = z.object({
  docType: z.string().min(1).max(50).default("budget_book"),
  title: z.string().min(1).max(200),
  fiscalYear: z.number().int().min(2000).max(2100),
  dataSource: z.enum(["module", "upload"]).default("module"),
  worksheetId: z.string().optional(),
  versionId: z.string().optional(),
  maxIterations: z.number().int().min(1).max(10).default(3),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const documentIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const documentIdWithTodoParamSchema = z.object({
  documentId: z.string().uuid(),
});

// ---- Backward-compatible aliases (books) ----

/** @deprecated Use createDocumentSchema instead. */
export const createBookSchema = createDocumentSchema;
/** @deprecated Use CreateDocumentInput instead. */
export type CreateBookInput = CreateDocumentInput;
/** @deprecated Use documentIdParamSchema instead. */
export const bookIdParamSchema = documentIdParamSchema;

export const bookIdWithTodoParamSchema = z.object({
  bookId: z.string().uuid(),
});

// ---- Todos ----

export const todoIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const sendMessageSchema = z.object({
  message: z.string().min(1).max(10000),
});

export const updateTodoStatusSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "skipped"]),
});
