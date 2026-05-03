import { asc, eq } from "drizzle-orm";
import { db, ensureDatabase } from "@/lib/db";
import { documents, statusSettings, syncErrors } from "@/lib/db/schema";
import { type Frontmatter, statusValues } from "@/lib/schema/frontmatter";

export type StatusValue = Frontmatter["status"];

export type MarkdownDocumentListItem = {
  filePath: string;
  title: string;
  url: string;
  pdfUrl: string | null;
  publishedAt: string;
  abstract: string;
  tags: string[];
  conference: string;
  status: StatusValue;
  body: string;
  bodyHtml: string;
  updatedAt: number;
};

export type MarkdownSyncErrorItem = {
  filePath: string;
  errorType: string;
  errorMessage: string;
  errorDetails: MarkdownSyncErrorDetails;
  updatedAt: number;
};

export type MarkdownSyncErrorDetails =
  | {
      kind: "frontmatter_validation";
      issues: Array<{
        path: string;
        message: string;
        code: string;
      }>;
    }
  | {
      kind: "parse_failed";
      message: string;
    };

export type MarkdownDashboardData = {
  documents: MarkdownDocumentListItem[];
  syncErrors: MarkdownSyncErrorItem[];
  statusOrder: StatusValue[];
  tags: string[];
};

function parseTags(value: string, filePath: string): string[] {
  const parsed = JSON.parse(value) as unknown;
  if (
    !Array.isArray(parsed) ||
    !parsed.every((tag) => typeof tag === "string")
  ) {
    throw new Error(`Invalid tags payload in documents.tags for ${filePath}`);
  }
  return parsed;
}

function parseErrorDetails(
  value: string,
  filePath: string,
  errorType: string,
): MarkdownSyncErrorDetails {
  const parsed = JSON.parse(value) as unknown;

  if (errorType === "frontmatter_validation") {
    if (
      !Array.isArray(parsed) ||
      !parsed.every(
        (issue) =>
          typeof issue === "object" &&
          issue !== null &&
          "path" in issue &&
          typeof issue.path === "string" &&
          "message" in issue &&
          typeof issue.message === "string" &&
          "code" in issue &&
          typeof issue.code === "string",
      )
    ) {
      throw new Error(
        `Invalid error_details payload for ${filePath}: expected frontmatter issues`,
      );
    }

    return {
      kind: "frontmatter_validation",
      issues: parsed,
    };
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("message" in parsed) ||
    typeof parsed.message !== "string"
  ) {
    throw new Error(
      `Invalid error_details payload for ${filePath}: expected parse error message`,
    );
  }

  return {
    kind: "parse_failed",
    message: parsed.message,
  };
}

function normalizeStatusOrder(input: string[]): StatusValue[] {
  const present = new Set(input);
  const normalized = statusValues.filter((status) => present.has(status));
  for (const status of statusValues) {
    if (!normalized.includes(status)) {
      normalized.push(status);
    }
  }
  return normalized;
}

function ensureStatusSettingsRows(): void {
  for (const [index, status] of statusValues.entries()) {
    db.insert(statusSettings)
      .values({ status, sortOrder: index })
      .onConflictDoNothing()
      .run();
  }
}

export function getStatusOrder(): StatusValue[] {
  ensureDatabase();
  ensureStatusSettingsRows();

  const rows = db
    .select({ status: statusSettings.status })
    .from(statusSettings)
    .orderBy(asc(statusSettings.sortOrder))
    .all();

  return normalizeStatusOrder(rows.map((row) => row.status));
}

export function updateStatusOrder(statusOrder: StatusValue[]): void {
  ensureDatabase();

  for (const [index, status] of statusOrder.entries()) {
    db.insert(statusSettings)
      .values({ status, sortOrder: index })
      .onConflictDoUpdate({
        target: statusSettings.status,
        set: { sortOrder: index },
      })
      .run();
  }
}

export function getDocuments(): MarkdownDocumentListItem[] {
  ensureDatabase();

  const rows = db
    .select()
    .from(documents)
    .orderBy(asc(documents.updatedAt), asc(documents.title))
    .all();

  return rows.map((row) => ({
    filePath: row.filePath,
    title: row.title,
    url: row.url,
    pdfUrl: row.pdfUrl,
    publishedAt: row.publishedAt,
    abstract: row.abstract,
    tags: parseTags(row.tags, row.filePath),
    conference: row.conference,
    status: row.status,
    body: row.body,
    bodyHtml: row.bodyHtml,
    updatedAt: row.updatedAt,
  }));
}

export function getSyncErrors(): MarkdownSyncErrorItem[] {
  ensureDatabase();

  const rows = db
    .select()
    .from(syncErrors)
    .orderBy(asc(syncErrors.filePath))
    .all();

  return rows.map((row) => ({
    filePath: row.filePath,
    errorType: row.errorType,
    errorMessage: row.errorMessage,
    errorDetails: parseErrorDetails(
      row.errorDetails,
      row.filePath,
      row.errorType,
    ),
    updatedAt: row.updatedAt,
  }));
}

export function getDashboardData(): MarkdownDashboardData {
  const documentsData = getDocuments();
  const errorsData = getSyncErrors();
  const statusOrder = getStatusOrder();
  const tags = [
    ...new Set(documentsData.flatMap((document) => document.tags)),
  ].sort((left, right) => left.localeCompare(right));

  return {
    documents: documentsData,
    syncErrors: errorsData,
    statusOrder,
    tags,
  };
}

export function getDocumentByTitle(
  title: string,
): MarkdownDocumentListItem | null {
  ensureDatabase();

  const row = db
    .select()
    .from(documents)
    .where(eq(documents.title, title))
    .get();
  if (!row) {
    return null;
  }

  return {
    filePath: row.filePath,
    title: row.title,
    url: row.url,
    pdfUrl: row.pdfUrl,
    publishedAt: row.publishedAt,
    abstract: row.abstract,
    tags: parseTags(row.tags, row.filePath),
    conference: row.conference,
    status: row.status,
    body: row.body,
    bodyHtml: row.bodyHtml,
    updatedAt: row.updatedAt,
  };
}
