import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { statusValues } from "@/lib/schema/frontmatter";
import * as schema from "./schema";

const dataDirectory = path.join(process.cwd(), "data");
const databasePath = path.join(dataDirectory, "sqlite.db");

mkdirSync(dataDirectory, { recursive: true });

const sqlite = new Database(databasePath);
sqlite.pragma("journal_mode = WAL");

const escapedStatusValues = statusValues
  .map((status) => `'${status.replaceAll("'", "''")}'`)
  .join(", ");
const statusCheck = `CHECK(status IN (${escapedStatusValues}))`;

let initialized = false;

export function ensureDatabase(): void {
  if (initialized) {
    return;
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL UNIQUE,
      file_mtime_ms INTEGER NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      pdf_url TEXT,
      published_at TEXT NOT NULL,
      abstract TEXT NOT NULL,
      tags TEXT NOT NULL,
      conference TEXT NOT NULL,
      status TEXT NOT NULL ${statusCheck},
      status_sort_order INTEGER NOT NULL DEFAULT 0,
      body TEXT NOT NULL,
      body_html TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS documents_status_idx ON documents (status);
    CREATE INDEX IF NOT EXISTS documents_title_idx ON documents (title);

    CREATE TABLE IF NOT EXISTS sync_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL UNIQUE,
      file_mtime_ms INTEGER NOT NULL,
      error_type TEXT NOT NULL,
      error_message TEXT NOT NULL,
      error_details TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS status_settings (
      status TEXT PRIMARY KEY ${statusCheck},
      sort_order INTEGER NOT NULL UNIQUE
    );
  `);

  const documentColumns = sqlite
    .prepare("PRAGMA table_info(documents)")
    .all() as Array<{ name: string }>;
  const hasStatusSortOrder = documentColumns.some(
    (column) => column.name === "status_sort_order",
  );
  if (!hasStatusSortOrder) {
    sqlite.exec(
      "ALTER TABLE documents ADD COLUMN status_sort_order INTEGER NOT NULL DEFAULT 0;",
    );
    sqlite.exec(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY status
            ORDER BY updated_at ASC, title ASC, id ASC
          ) - 1 AS sort_order
        FROM documents
      )
      UPDATE documents
      SET status_sort_order = (
        SELECT ranked.sort_order
        FROM ranked
        WHERE ranked.id = documents.id
      )
      WHERE id IN (SELECT id FROM ranked);
    `);
  }
  sqlite.exec(
    "CREATE INDEX IF NOT EXISTS documents_status_sort_order_idx ON documents (status, status_sort_order);",
  );

  const insertStatusSetting = sqlite.prepare(
    "INSERT INTO status_settings (status, sort_order) VALUES (?, ?) ON CONFLICT(status) DO NOTHING",
  );
  for (const [index, status] of statusValues.entries()) {
    insertStatusSetting.run(status, index);
  }

  initialized = true;
}

export const db = drizzle(sqlite, { schema });
