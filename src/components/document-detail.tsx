"use client";

import parse from "html-react-parser";
import Link from "next/link";
import { useEffect } from "react";
import type { MarkdownDocumentListItem } from "@/lib/markdown/repository";

type DocumentDetailProps = {
  document: MarkdownDocumentListItem;
  headingLevel?: "h1" | "h2";
};

export function DocumentDetail({ document }: DocumentDetailProps) {
  const HeadingTag = headingLevel;
  useEffect(() => {
    const previousTitle = window.document.title;
    window.document.title = `TMIS> ${document.title}`;
    return () => {
      window.document.title = previousTitle;
    };
  }, [document.title]);

  return (
    <article className="grid gap-2">
      <dl>
        <dt>status</dt>
        <dd>{document.status}</dd>
        <dt>published_at</dt>
        <dd>{document.publishedAt}</dd>
        <dt>conference</dt>
        <dd>{document.conference}</dd>
        <dt>tags</dt>
        <dd>{document.tags.join(", ")}</dd>
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
      <section>{parse(document.bodyHtml)}</section>
    </article>
  );
}
