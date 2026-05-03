export function splitTags(tags: string[]): string[] {
  const normalized = tags
    .flatMap((tag) => tag.split(","))
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  return [...new Set(normalized)];
}
