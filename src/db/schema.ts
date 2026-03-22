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

// ---- Enums ----

export const budgetBookStatusEnum = pgEnum("budget_book_status", [
  "draft",
  "analyzing",
  "generating",
  "reviewing",
  "revision",
  "completed",
  "completed_with_todos",
  "failed",
]);

export const budgetBookSectionTypeEnum = pgEnum("budget_book_section_type", [
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

export const budgetBookReviewerTypeEnum = pgEnum("budget_book_reviewer_type", [
  "gfoa",
  "ada",
]);

export const budgetBookJobTypeEnum = pgEnum("budget_book_job_type", [
  "analyze_prior_pdf",
  "generate_sections",
  "render_charts",
  "gfoa_review",
  "ada_review",
  "revise_sections",
  "render_pdf",
  "finalize",
]);

export const budgetBookJobStatusEnum = pgEnum("budget_book_job_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const budgetBookDataSourceEnum = pgEnum("budget_book_data_source", [
  "module",
  "upload",
]);

export const agentTypeEnum = pgEnum("agent_type", [
  "bb_creator",
  "bb_reviewer",
  "ada_reviewer",
  "bb_advisor",
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

// ---- Budget Books ----

export const budgetBooks = pgTable(
  "budget_books",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id").notNull(),
    worksheetId: text("worksheet_id"),
    versionId: text("version_id"),
    dataSource: budgetBookDataSourceEnum("data_source")
      .notNull()
      .default("module"),
    uploadedBudgetS3Key: text("uploaded_budget_s3_key"),
    title: text("title").notNull(),
    fiscalYear: integer("fiscal_year").notNull(),
    status: budgetBookStatusEnum("status").notNull().default("draft"),
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
    index("budget_book_tenant_idx").on(table.tenantId),
    index("budget_book_worksheet_idx").on(table.tenantId, table.worksheetId),
  ]
);

// ---- Budget Book Sections ----

export const budgetBookSections = pgTable(
  "budget_book_sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    budgetBookId: uuid("budget_book_id")
      .notNull()
      .references(() => budgetBooks.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    sectionType: budgetBookSectionTypeEnum("section_type").notNull(),
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
    index("budget_book_section_book_idx").on(table.budgetBookId),
  ]
);

// ---- Budget Book Reviews ----

export const budgetBookReviews = pgTable(
  "budget_book_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    budgetBookId: uuid("budget_book_id")
      .notNull()
      .references(() => budgetBooks.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    reviewerType: budgetBookReviewerTypeEnum("reviewer_type").notNull(),
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
    index("budget_book_review_book_idx").on(table.budgetBookId),
    index("budget_book_review_type_idx").on(
      table.budgetBookId,
      table.reviewerType
    ),
  ]
);

// ---- Budget Book Jobs (progress tracking) ----

export const budgetBookJobs = pgTable(
  "budget_book_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    budgetBookId: uuid("budget_book_id")
      .notNull()
      .references(() => budgetBooks.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    jobType: budgetBookJobTypeEnum("job_type").notNull(),
    status: budgetBookJobStatusEnum("status").notNull().default("pending"),
    progress: integer("progress").notNull().default(0),
    message: text("message"),
    error: text("error"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("budget_book_job_book_idx").on(table.budgetBookId)]
);

// ---- Agent Skills (self-improving skill system) ----

export const agentSkills = pgTable(
  "agent_skills",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentType: agentTypeEnum("agent_type").notNull(),
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

// ---- Budget Book Todos ----

export const budgetBookTodos = pgTable(
  "budget_book_todos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    budgetBookId: uuid("budget_book_id")
      .notNull()
      .references(() => budgetBooks.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    category: todoCategoryEnum("category").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    sectionType: budgetBookSectionTypeEnum("section_type"),
    status: todoStatusEnum("status").notNull().default("open"),
    priority: todoPriorityEnum("priority").notNull().default("medium"),
    sourceReviewId: uuid("source_review_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("budget_book_todo_book_idx").on(table.budgetBookId),
    index("budget_book_todo_status_idx").on(table.budgetBookId, table.status),
  ]
);

// ---- Budget Book Todo Messages ----

export const budgetBookTodoMessages = pgTable(
  "budget_book_todo_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    todoId: uuid("todo_id")
      .notNull()
      .references(() => budgetBookTodos.id, { onDelete: "cascade" }),
    role: todoMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    attachmentS3Keys: jsonb("attachment_s3_keys").$type<string[]>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("budget_book_todo_msg_todo_idx").on(table.todoId)]
);
