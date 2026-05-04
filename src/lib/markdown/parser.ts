import { readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import {
  type Frontmatter,
  frontmatterSchema,
  normalizePublishedAt,
  statusValues,
} from "@/lib/schema/frontmatter";

type ParseInput = {
  absolutePath: string;
  filePath: string;
  fileMtimeMs: number;
};

type ParseFailure = {
  ok: false;
  filePath: string;
  fileMtimeMs: number;
  errorType: "frontmatter_validation" | "parse_failed";
  errorMessage: string;
  errorDetails: string;
  draft: {
    title: string;
    url: string;
    pdfUrl: string | null;
    publishedAt: string;
    abstract: string;
    tags: string[];
    conference: string;
    status: Frontmatter["status"] | null;
    body: string;
    bodyHtml: string;
  };
};

type ParseSuccess = {
  ok: true;
  filePath: string;
  fileMtimeMs: number;
  title: string;
  url: string;
  pdfUrl: string | null;
  publishedAt: string;
  abstract: string;
  tags: string[];
  conference: string;
  status: Frontmatter["status"];
  body: string;
  bodyHtml: string;
};

export type ParseMarkdownResult = ParseFailure | ParseSuccess;

function buildFallbackTitle(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

function extractDraft(
  filePath: string,
  frontmatterData: unknown,
  body: string,
  bodyHtml: string,
  failedFields = new Set<string>(),
): ParseFailure["draft"] {
  const data =
    typeof frontmatterData === "object" && frontmatterData !== null
      ? (frontmatterData as Record<string, unknown>)
      : {};
  const allowedStatus = new Set<Frontmatter["status"]>(statusValues);

  const rawTitle = typeof data.title === "string" ? data.title.trim() : "";
  const title = rawTitle.length > 0 ? rawTitle : buildFallbackTitle(filePath);
  const url =
    !failedFields.has("url") && typeof data.url === "string" ? data.url : "";
  const pdfUrl =
    !failedFields.has("pdf_url") && typeof data.pdf_url === "string"
      ? data.pdf_url
      : null;
  const publishedAt =
    !failedFields.has("published_at") &&
    (typeof data.published_at === "string" || data.published_at instanceof Date)
      ? normalizePublishedAt(data.published_at as Frontmatter["published_at"])
      : "";
  const abstract =
    !failedFields.has("abstract") && typeof data.abstract === "string"
      ? data.abstract
      : "";
  const tags =
    !failedFields.has("tags") &&
    Array.isArray(data.tags) &&
    data.tags.every((tag) => typeof tag === "string")
      ? data.tags
      : [];
  const conference =
    !failedFields.has("conference") && typeof data.conference === "string"
      ? data.conference
      : "";
  const status =
    !failedFields.has("status") &&
    typeof data.status === "string" &&
    allowedStatus.has(data.status as Frontmatter["status"])
      ? (data.status as Frontmatter["status"])
      : null;

  return {
    title,
    url,
    pdfUrl,
    publishedAt,
    abstract,
    tags,
    conference,
    status,
    body,
    bodyHtml,
  };
}

export async function parseMarkdownFile(
  input: ParseInput,
): Promise<ParseMarkdownResult> {
  try {
    const source = await readFile(input.absolutePath, "utf8");
    const parsed = matter(source);
    const markdownBody = parsed.content;
    let bodyHtml = "";
    try {
      bodyHtml = String(
        await unified()
          .use(remarkParse)
          .use(remarkGfm)
          .use(remarkRehype)
          .use(rehypeStringify)
          .process(markdownBody),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown parsing error";
      return {
        ok: false,
        filePath: input.filePath,
        fileMtimeMs: input.fileMtimeMs,
        errorType: "parse_failed",
        errorMessage: message,
        errorDetails: JSON.stringify({ message }),
        draft: extractDraft(input.filePath, parsed.data, markdownBody, ""),
      };
    }

    const validated = frontmatterSchema.safeParse(parsed.data);

    if (!validated.success) {
      const issues = validated.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      }));
      const failedFields = new Set<string>(
        validated.error.issues
          .map((issue) => issue.path[0])
          .filter((value): value is string => typeof value === "string"),
      );

      return {
        ok: false,
        filePath: input.filePath,
        fileMtimeMs: input.fileMtimeMs,
        errorType: "frontmatter_validation",
        errorMessage: issues
          .map((issue) => `${issue.path || "(root)"}: ${issue.message}`)
          .join(" | "),
        errorDetails: JSON.stringify(issues),
        draft: extractDraft(
          input.filePath,
          parsed.data,
          markdownBody,
          bodyHtml,
          failedFields,
        ),
      };
    }

    const rawTitle =
      typeof parsed.data.title === "string" ? parsed.data.title.trim() : "";
    const title =
      rawTitle.length > 0 ? rawTitle : buildFallbackTitle(input.filePath);

    return {
      ok: true,
      filePath: input.filePath,
      fileMtimeMs: input.fileMtimeMs,
      title,
      url: validated.data.url,
      pdfUrl: validated.data.pdf_url ?? null,
      publishedAt: normalizePublishedAt(validated.data.published_at),
      abstract: validated.data.abstract,
      tags: validated.data.tags,
      conference: validated.data.conference,
      status: validated.data.status,
      body: markdownBody,
      bodyHtml,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown parsing error";
    return {
      ok: false,
      filePath: input.filePath,
      fileMtimeMs: input.fileMtimeMs,
      errorType: "parse_failed",
      errorMessage: message,
      errorDetails: JSON.stringify({ message }),
      draft: {
        title: buildFallbackTitle(input.filePath),
        url: "",
        pdfUrl: null,
        publishedAt: "",
        abstract: "",
        tags: [],
        conference: "",
        status: null,
        body: "",
        bodyHtml: "",
      },
    };
  }
}
