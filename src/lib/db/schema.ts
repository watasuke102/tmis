import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { statusValues } from "@/lib/schema/frontmatter";

export const documents = sqliteTable(
  "documents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    filePath: text("file_path").notNull().unique(),
    fileMtimeMs: integer("file_mtime_ms").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    pdfUrl: text("pdf_url"),
    publishedAt: text("published_at").notNull(),
    abstract: text("abstract").notNull(),
    tags: text("tags").notNull(),
    conference: text("conference").notNull(),
    status: text("status", { enum: statusValues }).notNull(),
    statusSortOrder: integer("status_sort_order").notNull(),
    body: text("body").notNull(),
    bodyHtml: text("body_html").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("documents_status_idx").on(table.status),
    index("documents_status_sort_order_idx").on(
      table.status,
      table.statusSortOrder,
    ),
    index("documents_title_idx").on(table.title),
  ],
);

export const syncErrors = sqliteTable("sync_errors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filePath: text("file_path").notNull().unique(),
  fileMtimeMs: integer("file_mtime_ms").notNull(),
  errorType: text("error_type").notNull(),
  errorMessage: text("error_message").notNull(),
  errorDetails: text("error_details").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const statusSettings = sqliteTable("status_settings", {
  status: text("status", { enum: statusValues }).primaryKey(),
  sortOrder: integer("sort_order").notNull().unique(),
});

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type SyncError = typeof syncErrors.$inferSelect;
