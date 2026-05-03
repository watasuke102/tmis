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

export async function parseMarkdownFile(
  input: ParseInput,
): Promise<ParseMarkdownResult> {
  try {
    const source = await readFile(input.absolutePath, "utf8");
    const parsed = matter(source);
    const validated = frontmatterSchema.safeParse(parsed.data);

    if (!validated.success) {
      const issues = validated.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      }));

      return {
        ok: false,
        filePath: input.filePath,
        fileMtimeMs: input.fileMtimeMs,
        errorType: "frontmatter_validation",
        errorMessage: issues
          .map((issue) => `${issue.path || "(root)"}: ${issue.message}`)
          .join(" | "),
        errorDetails: JSON.stringify(issues),
      };
    }

    const markdownBody = parsed.content;
    const bodyHtml = String(
      await unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype)
        .use(rehypeStringify)
        .process(markdownBody),
    );

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
    };
  }
}
