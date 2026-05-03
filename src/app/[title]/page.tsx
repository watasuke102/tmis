import { notFound } from "next/navigation";
import { DocumentDetail } from "@/components/document-detail";
import { getDocumentByTitle } from "@/lib/markdown/repository";

type DocumentPageProps = {
  params: Promise<{ title: string }>;
};

export const dynamic = "force-dynamic";

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { title: encodedTitle } = await params;
  const title = decodeURIComponent(encodedTitle);
  const document = getDocumentByTitle(title);

  if (!document) {
    notFound();
  }

  return (
    <main className="grid min-h-screen">
      <DocumentDetail document={document} />
    </main>
  );
}
