import { splitTags } from "@/lib/tags";

type TagListProps = {
  tags: string[];
};

export function TagList({ tags }: TagListProps) {
  const normalizedTags = splitTags(tags);

  if (normalizedTags.length === 0) {
    return <span>-</span>;
  }

  return (
    <span className="flex flex-wrap gap-2">
      {normalizedTags.map((tag) => (
        <span
          key={tag}
          className="px-1 border-2 border-primary rounded-sm text-sm"
        >
          {tag}
        </span>
      ))}
    </span>
  );
}
