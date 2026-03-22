import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  index,
} from "drizzle-orm/pg-core";

// ---- Enums (universal across all document types) ----

export const documentStatusEnum = pgEnum("document_status", [
  "draft",
  "analyzing",
  "generating",
  "reviewing",
  "revision",
  "completed",
  "completed_with_todos",
  "failed",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const dataSourceEnum = pgEnum("data_source", [
  "module",
  "upload",
]);

export const skillScopeEnum = pgEnum("skill_scope", ["global", "customer"]);

export const skillStatusEnum = pgEnum("skill_status", [
  "active",
  "retired",
  "challenged",
]);

export const todoCategoryEnum = pgEnum("todo_category", [
  "data_gap",
  "clarification",
  "quality",
]);

export const todoStatusEnum = pgEnum("todo_status", [
  "open",
  "in_progress",
  "resolved",
  "skipped",
]);

export const todoPriorityEnum = pgEnum("todo_priority", [
  "high",
  "medium",
  "low",
]);

export const todoMessageRoleEnum = pgEnum("todo_message_role", [
  "agent",
  "user",
]);

// ---- Documents ----

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id").notNull(),
    docType: text("doc_type").notNull(),
    worksheetId: text("worksheet_id"),
    versionId: text("version_id"),
    dataSource: dataSourceEnum("data_source")
      .notNull()
      .default("module"),
    uploadedDataS3Key: text("uploaded_data_s3_key"),
    title: text("title").notNull(),
    fiscalYear: integer("fiscal_year").notNull(),
    status: documentStatusEnum("status").notNull().default("draft"),
    priorYearPdfS3Key: text("prior_year_pdf_s3_key"),
    styleAnalysis: jsonb("style_analysis").$type<Record<string, unknown>>(),
    generatedPdfS3Key: text("generated_pdf_s3_key"),
    webPreviewData: jsonb("web_preview_data").$type<Record<string, unknown>>(),
    currentIteration: integer("current_iteration").notNull().default(0),
    maxIterations: integer("max_iterations").notNull().default(3),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("document_tenant_idx").on(table.tenantId),
    index("document_tenant_type_idx").on(table.tenantId, table.docType),
  ]
);

// ---- Document Sections ----

export const documentSections = pgTable(
  "document_sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    sectionType: text("section_type").notNull(),
    sectionOrder: integer("section_order").notNull(),
    title: text("title").notNull(),
    narrativeContent: text("narrative_content"),
    tableData: jsonb("table_data").$type<Record<string, unknown>[]>(),
    chartConfigs: jsonb("chart_configs").$type<Record<string, unknown>[]>(),
    chartImageS3Keys: jsonb("chart_image_s3_keys").$type<string[]>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("document_section_doc_idx").on(table.documentId),
  ]
);

// ---- Document Reviews ----

export const documentReviews = pgTable(
  "document_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    reviewerType: text("reviewer_type").notNull(),
    iteration: integer("iteration").notNull(),
    overallScore: numeric("overall_score", { precision: 6, scale: 2 }),
    passed: boolean("passed").notNull().default(false),
    report: jsonb("report").notNull().$type<Record<string, unknown>>(),
    recommendations: jsonb("recommendations").$type<
      Record<string, unknown>[]
    >(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("document_review_doc_idx").on(table.documentId),
    index("document_review_type_idx").on(
      table.documentId,
      table.reviewerType
    ),
  ]
);

// ---- Document Jobs (progress tracking) ----

export const documentJobs = pgTable(
  "document_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    jobType: text("job_type").notNull(),
    status: jobStatusEnum("status").notNull().default("pending"),
    progress: integer("progress").notNull().default(0),
    message: text("message"),
    error: text("error"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("document_job_doc_idx").on(table.documentId)]
);

// ---- Agent Skills (self-improving skill system) ----

export const agentSkills = pgTable(
  "agent_skills",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentType: text("agent_type").notNull(),
    tenantId: text("tenant_id"),
    scope: skillScopeEnum("scope").notNull().default("customer"),
    skill: text("skill").notNull(),
    category: text("category").notNull(),
    trigger: text("trigger"),
    evidence: text("evidence"),
    source: text("source"),
    confidence: numeric("confidence", { precision: 3, scale: 2 })
      .notNull()
      .default("0.80"),
    status: skillStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("agent_skill_type_tenant_idx").on(
      table.agentType,
      table.tenantId,
      table.status
    ),
    index("agent_skill_scope_idx").on(
      table.agentType,
      table.scope,
      table.status
    ),
  ]
);

// ---- Document Todos ----

export const documentTodos = pgTable(
  "document_todos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    category: todoCategoryEnum("category").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    sectionType: text("section_type"),
    status: todoStatusEnum("status").notNull().default("open"),
    priority: todoPriorityEnum("priority").notNull().default("medium"),
    sourceReviewId: uuid("source_review_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("document_todo_doc_idx").on(table.documentId),
    index("document_todo_status_idx").on(table.documentId, table.status),
  ]
);

// ---- Document Todo Messages ----

export const documentTodoMessages = pgTable(
  "document_todo_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    todoId: uuid("todo_id")
      .notNull()
      .references(() => documentTodos.id, { onDelete: "cascade" }),
    role: todoMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    attachmentS3Keys: jsonb("attachment_s3_keys").$type<string[]>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("document_todo_msg_todo_idx").on(table.todoId)]
);
