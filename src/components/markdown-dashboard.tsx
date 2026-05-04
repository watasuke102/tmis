"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  GripVertical,
  LayoutGrid,
  Search,
  SlidersHorizontal,
  Table2,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { TagList } from "@/components/tag-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  MarkdownDashboardData,
  MarkdownDocumentListItem,
  MarkdownSyncErrorItem,
  StatusValue,
} from "@/lib/markdown/repository";
import { splitTags } from "@/lib/tags";

type ViewMode = "grid" | "table";
type TabValue = ViewMode | "errors";
type DocumentsByStatus = Record<StatusValue, MarkdownDocumentListItem[]>;

type MarkdownDashboardProps = {
  data: MarkdownDashboardData;
};

type StatusGroupProps = {
  status: StatusValue;
  documents: MarkdownDocumentListItem[];
  viewMode: ViewMode;
  canReorder: boolean;
  onDocumentOrderChange: (nextDocuments: MarkdownDocumentListItem[]) => void;
};

type StatusOrderMenuProps = {
  statusOrder: StatusValue[];
  onChange: (statusOrder: StatusValue[]) => void;
};

type FilterAreaProps = {
  data: MarkdownDashboardData;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  selectedTags: string[];
  onClearSelectedTags: () => void;
  onToggleTag: (tag: string) => void;
  statusOrder: StatusValue[];
  onStatusOrderChange: (statusOrder: StatusValue[]) => void;
};

function buildDocumentsByStatus(
  statusOrder: StatusValue[],
  documents: MarkdownDocumentListItem[],
): DocumentsByStatus {
  const grouped: Partial<DocumentsByStatus> = {};
  for (const status of statusOrder) {
    grouped[status] = [];
  }
  for (const document of documents) {
    if (!grouped[document.status]) {
      grouped[document.status] = [];
    }
    grouped[document.status]?.push(document);
  }
  return grouped as DocumentsByStatus;
}

function ErrorDetails({ error }: { error: MarkdownSyncErrorItem }) {
  if (error.errorDetails.kind === "frontmatter_validation") {
    return (
      <ul className="list-disc ml-4 pl-2">
        {error.errorDetails.issues.map((issue, index) => (
          <li key={`${error.filePath}-${index}`}>
            <code className="font-bold">
              {issue.path.length > 0 ? issue.path : "(root)"}
            </code>
            : {issue.message}
          </li>
        ))}
      </ul>
    );
  }

  return <p>{error.errorDetails.message}</p>;
}

function SortableGridDocumentCard({
  document,
}: {
  document: MarkdownDocumentListItem;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: document.filePath });
  const style = {
    transform: transform
      ? `translate3d(${Math.trunc(transform.x)}px, ${Math.trunc(transform.y)}px, 0)`
      : undefined,
    transition,
  };

  return (
    <article
      className="group grid grid-rows-subgrid row-span-4 gap-1 border rounded-xs hover:bg-foreground/8"
      ref={setNodeRef}
      style={style}
    >
      <header className="flex items-center justify-between gap-1 p-1">
        <Link
          href={`/${encodeURIComponent(document.title)}`}
          className="font-bold group-hover:underline"
        >
          {document.title}
        </Link>
        <Button
          type="button"
          className="h-6 w-6 border-none hover:cursor-move"
          {...attributes}
          {...listeners}
          aria-label={`ドラッグして${document.title}の順序を並び替え`}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
      </header>
      <div className="flex justify-between items-center gap-1 border-t px-1 pt-1 text-sm text-foreground/80">
        <span>{document.publishedAt.slice(0, 10)}</span>
        <span>{document.conference}</span>
      </div>
      <p className="text-sm px-1">{document.abstract}</p>
      <div className="px-2 pb-2">
        <TagList tags={document.tags} />
      </div>
    </article>
  );
}

function SortableTableDocumentRow({
  document,
}: {
  document: MarkdownDocumentListItem;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: document.filePath });
  const style = {
    transform: transform
      ? `translate3d(${Math.trunc(transform.x)}px, ${Math.trunc(transform.y)}px, 0)`
      : undefined,
    transition,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-12 p-1">
        <Button
          type="button"
          className="h-6 w-6 border-none hover:cursor-move"
          {...attributes}
          {...listeners}
          aria-label={`ドラッグして${document.title}の順序を並び替え`}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
      </TableCell>
      <TableCell>
        <Link
          href={`/${encodeURIComponent(document.title)}`}
          className="font-bold hover:underline"
        >
          {document.title}
        </Link>
      </TableCell>
      <TableCell className="text-sm p-2">{document.abstract}</TableCell>
      <TableCell className="text-nowrap">{document.conference}</TableCell>
      <TableCell className="p-1">
        <TagList tags={document.tags} />
      </TableCell>
      <TableCell>{document.publishedAt.slice(0, 10)}</TableCell>
    </TableRow>
  );
}

function StatusGroup({
  status,
  documents,
  viewMode,
  canReorder,
  onDocumentOrderChange,
}: StatusGroupProps) {
  const sensors = useSensors(useSensor(PointerSensor));
  const sortableIds = documents.map((document) => document.filePath);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const currentIndex = documents.findIndex(
      (document) => document.filePath === active.id,
    );
    const nextIndex = documents.findIndex(
      (document) => document.filePath === over.id,
    );
    if (currentIndex < 0 || nextIndex < 0) {
      return;
    }

    onDocumentOrderChange(arrayMove(documents, currentIndex, nextIndex));
  }

  const shouldUseDnD = canReorder && documents.length > 1;

  return (
    <section className="px-2 grid gap-1">
      <header className="flex items-center gap-2">
        <h2 className="text-2xl font-bold">{status}</h2>
        <Badge>{documents.length}</Badge>
      </header>

      {viewMode === "grid" ? (
        shouldUseDnD ? (
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
            sensors={sensors}
          >
            <SortableContext
              items={sortableIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                {documents.map((document) => (
                  <SortableGridDocumentCard
                    document={document}
                    key={document.filePath}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {documents.map((document) => (
              <Link
                href={`/${encodeURIComponent(document.title)}`}
                key={document.filePath}
                className="group grid grid-rows-subgrid row-span-4 gap-1 border rounded-xs hover:bg-foreground/8"
              >
                <h3 className="font-bold p-1 group-hover:underline">
                  {document.title}
                </h3>
                <div className="flex justify-between items-center gap-1 border-t px-1 pt-1 text-sm text-foreground/80">
                  <span>{document.publishedAt.slice(0, 10)}</span>
                  <span>{document.conference}</span>
                </div>
                <p className="text-sm px-1">{document.abstract}</p>
                <div className="px-2 pb-2">
                  <TagList tags={document.tags} />
                </div>
              </Link>
            ))}
            {documents.length === 0 ? <p>No documents</p> : null}
          </div>
        )
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">sort</TableHead>
              <TableHead className="min-w-[35vw]">title</TableHead>
              <TableHead className="min-w-[50vw]">abstract</TableHead>
              <TableHead>conference</TableHead>
              <TableHead>tags</TableHead>
              <TableHead>published_at</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shouldUseDnD ? (
              <DndContext
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
                sensors={sensors}
              >
                <SortableContext
                  items={sortableIds}
                  strategy={verticalListSortingStrategy}
                >
                  {documents.map((document) => (
                    <SortableTableDocumentRow
                      document={document}
                      key={document.filePath}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              documents.map((document) => (
                <TableRow key={document.filePath}>
                  <TableCell />
                  <TableCell>
                    <Link
                      href={`/${encodeURIComponent(document.title)}`}
                      className="font-bold hover:underline"
                    >
                      {document.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm p-2">
                    {document.abstract}
                  </TableCell>
                  <TableCell className="text-nowrap">
                    {document.conference}
                  </TableCell>
                  <TableCell className="p-1">
                    <TagList tags={document.tags} />
                  </TableCell>
                  <TableCell>{document.publishedAt.slice(0, 10)}</TableCell>
                </TableRow>
              ))
            )}
            {documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>No documents</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

function StatusOrderItem({ status }: { status: StatusValue }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: status });
  const style = {
    transform: transform
      ? `translate3d(${Math.trunc(transform.x)}px, ${Math.trunc(transform.y)}px, 0)`
      : undefined,
    transition,
  };

  return (
    <li
      className="flex items-center gap-1 border bg-foreground text-background hover:cursor-move"
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      aria-label={`ドラッグして${status}の順序を並び替え`}
    >
      <Button className="border-none hover:cursor-move">
        <GripVertical className="h-4 w-4" />
      </Button>
      <span>{status}</span>
    </li>
  );
}

function StatusOrderMenu({ statusOrder, onChange }: StatusOrderMenuProps) {
  const [open, setOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor));

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const currentIndex = statusOrder.indexOf(active.id as StatusValue);
    const nextIndex = statusOrder.indexOf(over.id as StatusValue);
    if (currentIndex < 0 || nextIndex < 0) {
      return;
    }

    onChange(arrayMove(statusOrder, currentIndex, nextIndex));
  }

  return (
    <div className="inline relative grid gap-1">
      <Button
        onClick={() => setOpen((current) => !current)}
        type="button"
        className="text-background bg-foreground rounded-full px-2 mt-1 text-sm"
      >
        <SlidersHorizontal className="h-4 w-4" />
        status順を並び替え
      </Button>
      {open ? (
        <div className="absolute right-2 top-full z-10 grid w-64 gap-1 border bg-background px-3 py-2 rounded-sm">
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
            sensors={sensors}
          >
            <SortableContext
              items={statusOrder}
              strategy={verticalListSortingStrategy}
            >
              <ul className="grid gap-1 ml-0!">
                {statusOrder.map((status) => (
                  <StatusOrderItem key={status} status={status} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      ) : null}
    </div>
  );
}

function FilterArea({
  data,
  searchQuery,
  onSearchQueryChange,
  selectedTags,
  onClearSelectedTags,
  onToggleTag,
  statusOrder,
  onStatusOrderChange,
}: FilterAreaProps) {
  return (
    <section className="grid gap-1 border px-2 pt-2 pb-1">
      <div className="flex gap-3 items-center justify-between">
        <div className="flex grow items-center gap-1">
          <Search className="h-4 w-4" />
          <Input
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="title, abstract, body"
            type="search"
            value={searchQuery}
            className="px-1 grow"
          />
        </div>
        <StatusOrderMenu
          onChange={onStatusOrderChange}
          statusOrder={statusOrder}
        />
      </div>
      <div className="flex gap-2 items-center">
        <span className="text-lg font-bold">tag</span>
        <Button
          disabled={selectedTags.length === 0}
          onClick={onClearSelectedTags}
          type="button"
          className="text-sm"
        >
          タグ選択をクリア
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {data.tags.map((tag) => (
          <label
            className="inline-flex gap-1 items-center border px-1 text-sm select-none"
            key={tag}
          >
            <input
              checked={selectedTags.includes(tag)}
              onChange={() => onToggleTag(tag)}
              type="checkbox"
            />
            <span>{tag}</span>
          </label>
        ))}
        {data.tags.length === 0 ? <span>-</span> : null}
      </div>
    </section>
  );
}

export function MarkdownDashboard({ data }: MarkdownDashboardProps) {
  const router = useRouter();
  const hasMountedRef = useRef(false);

  const [activeTab, setActiveTab] = useState<TabValue>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [statusOrder, setStatusOrder] = useState<StatusValue[]>(
    data.statusOrder,
  );
  const [documentsByStatus, setDocumentsByStatus] = useState<DocumentsByStatus>(
    () => buildDocumentsByStatus(data.statusOrder, data.documents),
  );

  useEffect(() => {
    setStatusOrder(data.statusOrder);
    setDocumentsByStatus(
      buildDocumentsByStatus(data.statusOrder, data.documents),
    );
  }, [data.documents, data.statusOrder]);

  useEffect(() => {
    if (hasMountedRef.current) {
      return;
    }
    hasMountedRef.current = true;

    void fetch("/api/sync", { method: "POST" }).then(async (response) => {
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { changed?: boolean };
      if (payload.changed) {
        router.refresh();
      }
    });
  }, [router]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const canReorderDocuments =
    normalizedSearchQuery.length === 0 && selectedTags.length === 0;

  const groupedDocuments = useMemo(() => {
    const grouped: Partial<DocumentsByStatus> = {};
    for (const status of statusOrder) {
      const source = documentsByStatus[status] ?? [];
      grouped[status] = source.filter((document) => {
        const documentTags = splitTags(document.tags);
        const matchesTag =
          selectedTags.length === 0 ||
          selectedTags.some((selectedTag) =>
            documentTags.includes(selectedTag),
          );
        if (!matchesTag) {
          return false;
        }

        if (normalizedSearchQuery.length === 0) {
          return true;
        }

        const title = document.title.toLowerCase();
        const abstract = document.abstract.toLowerCase();
        const body = document.body.toLowerCase();
        return (
          title.includes(normalizedSearchQuery) ||
          abstract.includes(normalizedSearchQuery) ||
          body.includes(normalizedSearchQuery)
        );
      });
    }
    return grouped as DocumentsByStatus;
  }, [documentsByStatus, normalizedSearchQuery, selectedTags, statusOrder]);

  async function persistStatusOrder(nextStatusOrder: StatusValue[]) {
    const response = await fetch("/api/status-settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ statusOrder: nextStatusOrder }),
    });
    if (!response.ok) {
      router.refresh();
    }
  }

  async function persistDocumentOrder(
    status: StatusValue,
    orderedFilePaths: string[],
  ) {
    const response = await fetch("/api/document-order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, orderedFilePaths }),
    });
    if (!response.ok) {
      router.refresh();
    }
  }

  function onStatusOrderChange(nextStatusOrder: StatusValue[]) {
    setStatusOrder(nextStatusOrder);
    void persistStatusOrder(nextStatusOrder);
  }

  function onDocumentOrderChange(
    status: StatusValue,
    nextDocuments: MarkdownDocumentListItem[],
  ) {
    setDocumentsByStatus((current) => ({
      ...current,
      [status]: nextDocuments,
    }));
    void persistDocumentOrder(
      status,
      nextDocuments.map((document) => document.filePath),
    );
  }

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((selectedTag) => selectedTag !== tag)
        : [...current, tag],
    );
  }

  return (
    <section className="grid gap-2">
      <Tabs
        className="grid gap-3 grid-rows-[auto_1fr]"
        onValueChange={(value) => setActiveTab(value as TabValue)}
        value={activeTab}
      >
        <TabsList>
          <TabsTrigger value="grid">
            <LayoutGrid className="h-4 w-4" />
            Grid
          </TabsTrigger>
          <TabsTrigger value="table">
            <Table2 className="h-4 w-4" />
            Table
          </TabsTrigger>
          <div className="flex-1" />
          <TabsTrigger value="errors">
            <TriangleAlert className="h-4 w-4" />
            エラー
            <Badge>{data.syncErrors.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grid" className="grid-rows-[auto_1fr]">
          <FilterArea
            data={data}
            onClearSelectedTags={() => setSelectedTags([])}
            onSearchQueryChange={setSearchQuery}
            onStatusOrderChange={onStatusOrderChange}
            onToggleTag={toggleTag}
            searchQuery={searchQuery}
            selectedTags={selectedTags}
            statusOrder={statusOrder}
          />
          <div className="grid gap-2">
            {statusOrder.map((status) => (
              <StatusGroup
                documents={groupedDocuments[status] ?? []}
                key={status}
                status={status}
                viewMode="grid"
                canReorder={canReorderDocuments}
                onDocumentOrderChange={(nextDocuments) =>
                  onDocumentOrderChange(status, nextDocuments)
                }
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="table" className="grid-rows-[auto_1fr]">
          <FilterArea
            data={data}
            onClearSelectedTags={() => setSelectedTags([])}
            onSearchQueryChange={setSearchQuery}
            onStatusOrderChange={onStatusOrderChange}
            onToggleTag={toggleTag}
            searchQuery={searchQuery}
            selectedTags={selectedTags}
            statusOrder={statusOrder}
          />
          <div className="grid gap-2">
            {statusOrder.map((status) => (
              <StatusGroup
                documents={groupedDocuments[status] ?? []}
                key={status}
                status={status}
                viewMode="table"
                canReorder={canReorderDocuments}
                onDocumentOrderChange={(nextDocuments) =>
                  onDocumentOrderChange(status, nextDocuments)
                }
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="errors">
          <section className="grid gap-1">
            {data.syncErrors.map((error) => (
              <article className="grid gap-1 border p-1" key={error.filePath}>
                <h3 className="text-lg font-bold">{error.filePath}</h3>
                <p className="text-primary">{error.errorType}</p>
                <ErrorDetails error={error} />
              </article>
            ))}
            {data.syncErrors.length === 0 ? <p>No errors</p> : null}
          </section>
        </TabsContent>
      </Tabs>
    </section>
  );
}
