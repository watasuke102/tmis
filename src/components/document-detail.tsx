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
      <dl>
        <dt>status</dt>
        <dd>{document.status}</dd>
        <dt>published_at</dt>
        <dd>{document.publishedAt}</dd>
        <dt>conference</dt>
        <dd>{document.conference}</dd>
        <dt>tags</dt>
        <dd>
          <TagList tags={document.tags} />
        </dd>
        <dt>url</dt>
        <dd>
          <Link href={document.url} rel="noreferrer" target="_blank">
            {document.url}
          </Link>
        </dd>
        {document.pdfUrl ? (
          <>
            <dt>pdf_url</dt>
            <dd>
              <Link href={document.pdfUrl} rel="noreferrer" target="_blank">
                {document.pdfUrl}
              </Link>
            </dd>
          </>
        ) : null}
      </dl>
      <article className="markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {document.body}
        </ReactMarkdown>
      </article>
    </article>
  );
}
