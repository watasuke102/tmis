import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { eq, inArray, sql } from "drizzle-orm";
import { db, ensureDatabase } from "@/lib/db";
import { documents, syncErrors } from "@/lib/db/schema";
import { parseMarkdownFile } from "@/lib/markdown/parser";

const markdownExtensions = new Set([".md", ".markdown"]);

type DiscoveredMarkdownFile = {
  absolutePath: string;
  filePath: string;
  fileMtimeMs: number;
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

export async function syncMarkdownDirectory(): Promise<MarkdownSyncSummary> {
  ensureDatabase();

  const markdownDirectory = getMarkdownDirectory();
  const discoveredFiles = await collectMarkdownFiles(markdownDirectory);

  const existingDocuments = db
    .select({
      filePath: documents.filePath,
      fileMtimeMs: documents.fileMtimeMs,
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
  for (const row of existingDocuments) {
    existingByPath.set(row.filePath, row.fileMtimeMs);
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

    if (parsed.ok) {
      db.insert(documents)
        .values({
          filePath: parsed.filePath,
          fileMtimeMs: parsed.fileMtimeMs,
          title: parsed.title,
          url: parsed.url,
          pdfUrl: parsed.pdfUrl,
          publishedAt: parsed.publishedAt,
          abstract: parsed.abstract,
          tags: JSON.stringify(parsed.tags),
          conference: parsed.conference,
          status: parsed.status,
          body: parsed.body,
          bodyHtml: parsed.bodyHtml,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: documents.filePath,
          set: {
            fileMtimeMs: parsed.fileMtimeMs,
            title: parsed.title,
            url: parsed.url,
            pdfUrl: parsed.pdfUrl,
            publishedAt: parsed.publishedAt,
            abstract: parsed.abstract,
            tags: JSON.stringify(parsed.tags),
            conference: parsed.conference,
            status: parsed.status,
            body: parsed.body,
            bodyHtml: parsed.bodyHtml,
            updatedAt: now,
          },
        })
        .run();

      db.delete(syncErrors)
        .where(eq(syncErrors.filePath, parsed.filePath))
        .run();
    } else {
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

      db.delete(documents).where(eq(documents.filePath, parsed.filePath)).run();
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
