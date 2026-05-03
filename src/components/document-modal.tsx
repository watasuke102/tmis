"use client";

import { useRouter } from "next/navigation";
import { DocumentDetail } from "@/components/document-detail";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MarkdownDocumentListItem } from "@/lib/markdown/repository";

type DocumentModalProps = {
  document: MarkdownDocumentListItem;
};

export function DocumentModal({ document }: DocumentModalProps) {
  const router = useRouter();

  return (
    <Dialog open onOpenChange={(open) => !open && router.back()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{document.title}</DialogTitle>
          <DialogDescription>{document.filePath}</DialogDescription>
        </DialogHeader>
        <DocumentDetail document={document} headingLevel="h2" />
      </DialogContent>
    </Dialog>
  );
}
