import { notFound } from "next/navigation";
import { DocumentModal } from "@/components/document-modal";
import { getDocumentByTitle } from "@/lib/markdown/repository";

type InterceptedDocumentPageProps = {
  params: Promise<{ title: string }>;
};

export const dynamic = "force-dynamic";

export default async function InterceptedDocumentPage({
  params,
}: InterceptedDocumentPageProps) {
  const { title: encodedTitle } = await params;
  const title = decodeURIComponent(encodedTitle);
  const document = getDocumentByTitle(title);

  if (!document) {
    notFound();
  }

  return <DocumentModal document={document} />;
}
