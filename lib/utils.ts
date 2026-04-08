export function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function sortByLabel<T>(items: T[], getLabel: (item: T) => string): T[] {
  return [...items].sort((left, right) =>
    getLabel(left).localeCompare(getLabel(right), "es", { sensitivity: "base" })
  );
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function includesNormalizedText(value: string, query: string): boolean {
  return normalizeSearchText(value).includes(normalizeSearchText(query));
}
