import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { eq, inArray, sql } from "drizzle-orm";
import { db, ensureDatabase } from "@/lib/db";
import { documents, syncErrors } from "@/lib/db/schema";
import { parseMarkdownFile } from "@/lib/markdown/parser";
import { statusValues } from "@/lib/schema/frontmatter";

const markdownExtensions = new Set([".md", ".markdown"]);

type DiscoveredMarkdownFile = {
  absolutePath: string;
  filePath: string;
  fileMtimeMs: number;
};

type ExistingDocumentState = {
  status: (typeof documents.$inferSelect)["status"];
  statusSortOrder: number;
};

export type MarkdownSyncSummary = {
  markdownDirectory: string;
  scannedFileCount: number;
  changedFileCount: number;
  createdCount: number;
  updatedCount: number;
  deletedCount: number;
  errorCount: number;
  changed: boolean;
};

function getMarkdownDirectory(): string {
  const configured = process.env.MARKDOWN_DIR?.trim();
  if (!configured) {
    throw new Error("MARKDOWN_DIR is not configured.");
  }
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), configured);
}

async function collectMarkdownFiles(
  rootDirectory: string,
  currentDirectory = rootDirectory,
): Promise<DiscoveredMarkdownFile[]> {
  const entries = await readdir(currentDirectory, { withFileTypes: true });
  const discovered: DiscoveredMarkdownFile[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDirectory, entry.name);
    if (entry.isDirectory()) {
      discovered.push(
        ...(await collectMarkdownFiles(rootDirectory, absolutePath)),
      );
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!markdownExtensions.has(extension)) {
      continue;
    }

    const metadata = await stat(absolutePath);
    discovered.push({
      absolutePath,
      filePath: path
        .relative(rootDirectory, absolutePath)
        .split(path.sep)
        .join("/"),
      fileMtimeMs: Math.trunc(metadata.mtimeMs),
    });
  }

  return discovered;
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function resolveStatusSortOrder(
  existingDocument: ExistingDocumentState | undefined,
  nextStatus: ExistingDocumentState["status"],
): number {
  if (existingDocument && existingDocument.status === nextStatus) {
    return existingDocument.statusSortOrder;
  }
  if (existingDocument && existingDocument.status !== nextStatus) {
    db.update(documents)
      .set({
        statusSortOrder: sql`${documents.statusSortOrder} + 1`,
      })
      .where(eq(documents.status, nextStatus))
      .run();
    return 0;
  }

  const maxOrderRow = db
    .select({
      maxOrder: sql<number | null>`max(${documents.statusSortOrder})`,
    })
    .from(documents)
    .where(eq(documents.status, nextStatus))
    .get();
  return Number(maxOrderRow?.maxOrder ?? -1) + 1;
}

export async function syncMarkdownDirectory(): Promise<MarkdownSyncSummary> {
  ensureDatabase();

  const markdownDirectory = getMarkdownDirectory();
  const discoveredFiles = await collectMarkdownFiles(markdownDirectory);

  const existingDocuments = db
    .select({
      filePath: documents.filePath,
      fileMtimeMs: documents.fileMtimeMs,
      status: documents.status,
      statusSortOrder: documents.statusSortOrder,
    })
    .from(documents)
    .all();
  const existingErrors = db
    .select({
      filePath: syncErrors.filePath,
      fileMtimeMs: syncErrors.fileMtimeMs,
    })
    .from(syncErrors)
    .all();

  const existingByPath = new Map<string, number>();
  const existingDocumentsByPath = new Map<string, ExistingDocumentState>();
  for (const row of existingDocuments) {
    existingByPath.set(row.filePath, row.fileMtimeMs);
    existingDocumentsByPath.set(row.filePath, {
      status: row.status,
      statusSortOrder: row.statusSortOrder,
    });
  }
  for (const row of existingErrors) {
    if (!existingByPath.has(row.filePath)) {
      existingByPath.set(row.filePath, row.fileMtimeMs);
    }
  }

  const changedFiles = discoveredFiles.filter(
    (file) => existingByPath.get(file.filePath) !== file.fileMtimeMs,
  );

  let createdCount = 0;
  let updatedCount = 0;

  for (const file of changedFiles) {
    const now = Date.now();
    const existed = existingByPath.has(file.filePath);
    const parsed = await parseMarkdownFile(file);
    const existingDocument = existingDocumentsByPath.get(parsed.filePath);
    const nextStatus = parsed.ok
      ? parsed.status
      : (parsed.draft.status ?? existingDocument?.status ?? statusValues[0]);
    const statusSortOrder = resolveStatusSortOrder(
      existingDocument,
      nextStatus,
    );

    const upsertValues = parsed.ok
      ? {
          filePath: parsed.filePath,
          fileMtimeMs: parsed.fileMtimeMs,
          title: parsed.title,
          url: parsed.url,
          pdfUrl: parsed.pdfUrl,
          publishedAt: parsed.publishedAt,
          abstract: parsed.abstract,
          tags: JSON.stringify(parsed.tags),
          conference: parsed.conference,
          status: nextStatus,
          statusSortOrder,
          body: parsed.body,
          bodyHtml: parsed.bodyHtml,
          createdAt: now,
          updatedAt: now,
        }
      : {
          filePath: parsed.filePath,
          fileMtimeMs: parsed.fileMtimeMs,
          title: parsed.draft.title,
          url: parsed.draft.url,
          pdfUrl: parsed.draft.pdfUrl,
          publishedAt: parsed.draft.publishedAt,
          abstract: parsed.draft.abstract,
          tags: JSON.stringify(parsed.draft.tags),
          conference: parsed.draft.conference,
          status: nextStatus,
          statusSortOrder,
          body: parsed.draft.body,
          bodyHtml: parsed.draft.bodyHtml,
          createdAt: now,
          updatedAt: now,
        };

    db.insert(documents)
      .values(upsertValues)
      .onConflictDoUpdate({
        target: documents.filePath,
        set: {
          fileMtimeMs: upsertValues.fileMtimeMs,
          title: upsertValues.title,
          url: upsertValues.url,
          pdfUrl: upsertValues.pdfUrl,
          publishedAt: upsertValues.publishedAt,
          abstract: upsertValues.abstract,
          tags: upsertValues.tags,
          conference: upsertValues.conference,
          status: upsertValues.status,
          statusSortOrder: upsertValues.statusSortOrder,
          body: upsertValues.body,
          bodyHtml: upsertValues.bodyHtml,
          updatedAt: now,
        },
      })
      .run();

    if (parsed.ok) {
      db.delete(syncErrors)
        .where(eq(syncErrors.filePath, parsed.filePath))
        .run();
    } else {
      const existingDocument = existingDocumentsByPath.get(parsed.filePath);
      const nextStatus =
        parsed.draft.status ?? existingDocument?.status ?? statusValues[0];
      let statusSortOrder = 0;
      if (existingDocument && existingDocument.status === nextStatus) {
        statusSortOrder = existingDocument.statusSortOrder;
      } else if (existingDocument && existingDocument.status !== nextStatus) {
        db.update(documents)
          .set({
            statusSortOrder: sql`${documents.statusSortOrder} + 1`,
          })
          .where(eq(documents.status, nextStatus))
          .run();
        statusSortOrder = 0;
      } else {
        statusSortOrder =
          Number(
            db
              .select({
                maxOrder: sql<number | null>`max(${documents.statusSortOrder})`,
              })
              .from(documents)
              .where(eq(documents.status, nextStatus))
              .get()?.maxOrder ?? -1,
          ) + 1;
      }

      db.insert(documents)
        .values({
          filePath: parsed.filePath,
          fileMtimeMs: parsed.fileMtimeMs,
          title: parsed.draft.title,
          url: parsed.draft.url,
          pdfUrl: parsed.draft.pdfUrl,
          publishedAt: parsed.draft.publishedAt,
          abstract: parsed.draft.abstract,
          tags: JSON.stringify(parsed.draft.tags),
          conference: parsed.draft.conference,
          status: nextStatus,
          statusSortOrder,
          body: parsed.draft.body,
          bodyHtml: parsed.draft.bodyHtml,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: documents.filePath,
          set: {
            fileMtimeMs: parsed.fileMtimeMs,
            title: parsed.draft.title,
            url: parsed.draft.url,
            pdfUrl: parsed.draft.pdfUrl,
            publishedAt: parsed.draft.publishedAt,
            abstract: parsed.draft.abstract,
            tags: JSON.stringify(parsed.draft.tags),
            conference: parsed.draft.conference,
            status: nextStatus,
            statusSortOrder,
            body: parsed.draft.body,
            bodyHtml: parsed.draft.bodyHtml,
            updatedAt: now,
          },
        })
        .run();

      db.insert(syncErrors)
        .values({
          filePath: parsed.filePath,
          fileMtimeMs: parsed.fileMtimeMs,
          errorType: parsed.errorType,
          errorMessage: parsed.errorMessage,
          errorDetails: parsed.errorDetails,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: syncErrors.filePath,
          set: {
            fileMtimeMs: parsed.fileMtimeMs,
            errorType: parsed.errorType,
            errorMessage: parsed.errorMessage,
            errorDetails: parsed.errorDetails,
            updatedAt: now,
          },
        })
        .run();
    }

    if (existed) {
      updatedCount += 1;
    } else {
      createdCount += 1;
    }
  }

  const knownPaths = new Set<string>([...existingByPath.keys()]);
  const currentPaths = new Set<string>(
    discoveredFiles.map((file) => file.filePath),
  );
  const deletedPaths = [...knownPaths].filter(
    (filePath) => !currentPaths.has(filePath),
  );

  for (const batch of chunk(deletedPaths, 200)) {
    if (batch.length === 0) {
      continue;
    }
    db.delete(documents).where(inArray(documents.filePath, batch)).run();
    db.delete(syncErrors).where(inArray(syncErrors.filePath, batch)).run();
  }

  const errorCountRow = db
    .select({ count: sql<number>`count(*)` })
    .from(syncErrors)
    .get();
  const errorCount = Number(errorCountRow?.count ?? 0);

  return {
    markdownDirectory,
    scannedFileCount: discoveredFiles.length,
    changedFileCount: changedFiles.length,
    createdCount,
    updatedCount,
    deletedCount: deletedPaths.length,
    errorCount,
    changed: changedFiles.length > 0 || deletedPaths.length > 0,
  };
}
