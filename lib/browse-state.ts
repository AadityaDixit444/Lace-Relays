import { looks, type StyleId, type Height } from "./styles";
import { ukSizes } from "./catalog";
import type { BrowseFilters } from "./observations";
export function parseFilters(params: URLSearchParams): BrowseFilters {
  const size = Number(params.get("size"));
  const budget = params.get("budget");
  const height = params.get("height") ?? "";
  return {
    styles: [...new Set((params.get("looks") ?? "").split(","))].filter(
      (v): v is StyleId => looks.some((l) => l.id === v),
    ),
    height: ["Low", "Mid", "High"].includes(height) ? (height as Height) : "",
    size: params.has("size") && ukSizes.includes(size) ? size : null,
    budgetPaise:
      budget !== null &&
      /^\d+(\.\d{1,2})?$/.test(budget) &&
      Number(budget) > 0 &&
      Number(budget) <= 1000000
        ? Math.round(Number(budget) * 100)
        : null,
  };
}
export function filterQuery(f: BrowseFilters) {
  const p = new URLSearchParams();
  if (f.styles.length) p.set("looks", f.styles.join(","));
  if (f.height) p.set("height", f.height);
  if (f.size !== null) p.set("size", String(f.size));
  if (f.budgetPaise !== null) p.set("budget", String(f.budgetPaise / 100));
  return p.toString();
}
