import { z } from "zod";

export const statusValues = [
  "LowPriority",
  "yet",
  "Next",
  "Reading",
  "partially",
  "read",
] as const;

export const statusSchema = z.enum(statusValues);

export const frontmatterSchema = z
  .object({
    url: z.string().min(1, "url is required"),
    pdf_url: z.string().nullable().optional(),
    published_at: z.union([z.date(), z.string().min(1)]).optional(),
    abstract: z.string(),
    tags: z.array(z.string()).optional().default([]),
    conference: z.string(),
    status: statusSchema,
  })
  .passthrough();

export type Frontmatter = z.infer<typeof frontmatterSchema>;

export function normalizePublishedAt(
  value: Frontmatter["published_at"],
): string {
  if (value === undefined) {
    return "";
  }
  return value instanceof Date ? value.toISOString() : value;
}
