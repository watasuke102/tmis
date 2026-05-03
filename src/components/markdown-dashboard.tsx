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

type ViewMode = "grid" | "table";
type TabValue = ViewMode | "errors";

type MarkdownDashboardProps = {
  data: MarkdownDashboardData;
};

type StatusGroupProps = {
  status: StatusValue;
  documents: MarkdownDocumentListItem[];
  viewMode: ViewMode;
};

type StatusOrderMenuProps = {
  statusOrder: StatusValue[];
  onChange: (statusOrder: StatusValue[]) => void;
};

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

function StatusGroup({ status, documents, viewMode }: StatusGroupProps) {
  return (
    <section className="px-2 grid gap-1">
      <header className="flex items-center gap-1">
        <h2 className="text-2xl font-bold">{status}</h2>
        <Badge>{documents.length}</Badge>
      </header>
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((document) => (
            <Link
              href={`/${encodeURIComponent(document.title)}`}
              key={document.filePath}
              className="grid gap-1 border rounded-xs p-1"
            >
              <h3 className="font-bold hover:underline">{document.title}</h3>
              <p className="text-sm">{document.abstract}</p>
              <p>{document.tags.join(", ")}</p>
            </Link>
          ))}
          {documents.length === 0 ? <p>No documents</p> : null}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>title</TableHead>
              <TableHead>conference</TableHead>
              <TableHead>tags</TableHead>
              <TableHead>published_at</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((document) => (
              <TableRow key={document.filePath}>
                <TableCell>
                  <Link href={`/${encodeURIComponent(document.title)}`}>
                    {document.title}
                  </Link>
                </TableCell>
                <TableCell>{document.conference}</TableCell>
                <TableCell>{document.tags.join(", ")}</TableCell>
                <TableCell>{document.publishedAt}</TableCell>
              </TableRow>
            ))}
            {documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>No documents</TableCell>
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
        <div className="absolute left-0 top-full z-10 grid w-64 gap-1 border bg-background p-2 rounded-sm">
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
            sensors={sensors}
          >
            <SortableContext
              items={statusOrder}
              strategy={verticalListSortingStrategy}
            >
              <ul className="grid gap-1">
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

export function MarkdownDashboard({ data }: MarkdownDashboardProps) {
  const router = useRouter();
  const hasMountedRef = useRef(false);

  const [activeTab, setActiveTab] = useState<TabValue>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [statusOrder, setStatusOrder] = useState<StatusValue[]>(
    data.statusOrder,
  );

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

  const filteredDocuments = useMemo(() => {
    return data.documents.filter((document) => {
      const matchesTag =
        selectedTag === "all" || document.tags.includes(selectedTag);
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
  }, [data.documents, normalizedSearchQuery, selectedTag]);

  const groupedDocuments = useMemo(() => {
    const grouped = new Map<StatusValue, MarkdownDocumentListItem[]>();
    for (const status of statusOrder) {
      grouped.set(status, []);
    }
    for (const document of filteredDocuments) {
      const group = grouped.get(document.status);
      if (group) {
        group.push(document);
      }
    }
    return grouped;
  }, [filteredDocuments, statusOrder]);

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

  function onStatusOrderChange(nextStatusOrder: StatusValue[]) {
    setStatusOrder(nextStatusOrder);
    void persistStatusOrder(nextStatusOrder);
  }

  function renderFilters(tagFilterId: string) {
    return (
      <section className="grid gap-1 border px-2 pt-2 pb-1">
        <div className="flex items-center gap-1">
          <Search className="h-4 w-4" />
          <Input
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="title, abstract, body"
            type="search"
            value={searchQuery}
            className="px-1"
          />
        </div>
        <label htmlFor={tagFilterId}>tag</label>
        <select
          id={tagFilterId}
          onChange={(event) => setSelectedTag(event.target.value)}
          value={selectedTag}
          className="border p-px"
        >
          <option value="all">all</option>
          {data.tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        <StatusOrderMenu
          onChange={onStatusOrderChange}
          statusOrder={statusOrder}
        />
      </section>
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

        <TabsContent value="grid">
          {renderFilters("tag-filter-grid")}
          <div className="grid gap-2">
            {statusOrder.map((status) => (
              <StatusGroup
                documents={groupedDocuments.get(status) ?? []}
                key={status}
                status={status}
                viewMode="grid"
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="table">
          {renderFilters("tag-filter-table")}
          <div className="grid gap-2">
            {statusOrder.map((status) => (
              <StatusGroup
                documents={groupedDocuments.get(status) ?? []}
                key={status}
                status={status}
                viewMode="table"
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
