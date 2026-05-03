"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { useEffect } from "react";
import { TagList } from "@/components/tag-list";
import type { MarkdownDocumentListItem } from "@/lib/markdown/repository";

type DocumentDetailProps = {
  document: MarkdownDocumentListItem;
  headingLevel?: "h1" | "h2";
};

export function DocumentDetail({ document }: DocumentDetailProps) {
  useEffect(() => {
    const previousTitle = window.document.title;
    window.document.title = `TMIS> ${document.title}`;
    return () => {
      window.document.title = previousTitle;
    };
  }, [document.title]);

  return (
    <article className="flex flex-col gap-2">
      <div className="grid grid-cols-[max-content_1fr] gap-x-4 border-b pb-3 border-b-2">
        <span className="font-bold">url</span>
        <span>
          <Link
            href={document.url}
            rel="noreferrer"
            target="_blank"
            className="text-primary underline"
          >
            {document.url}
          </Link>
        </span>
        {document.pdfUrl ? (
          <>
            <span className="font-bold">pdf_url</span>
            <span>
              <Link
                href={document.pdfUrl}
                rel="noreferrer"
                target="_blank"
                className="text-primary underline"
              >
                {document.pdfUrl}
              </Link>
            </span>
          </>
        ) : null}
        <span className="font-bold">status</span>
        <span>{document.status}</span>
        <span className="font-bold">published_at</span>
        <span>{document.publishedAt.slice(0, 10)}</span>
        <span className="font-bold">conference</span>
        <span>{document.conference}</span>
        <span className="font-bold">tags</span>
        <span>
          <TagList tags={document.tags} />
        </span>
      </div>
      <article className="markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {document.body}
        </ReactMarkdown>
      </article>
    </article>
  );
}
