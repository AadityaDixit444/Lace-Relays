import bindings from "@/data/retailer-bindings.json";
import requests from "@/data/pilot-requests.json";
import { shoes, type Shoe } from "./catalog";

// Coverage describes reviewed source connections; availability always comes from observations.
export function trackedStores(shoeId: string): string[] {
  return [
    ...new Set(
      bindings
        .filter((b) => b.verified && b.shoeId === shoeId)
        .map((b) => b.retailer),
    ),
  ];
}
function searchText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
export function matchesQuery(query: string, fields: string[]) {
  const words = query
    .replace(/\buk\s*\d+(?:\.\d+)?\b/gi, "")
    .trim()
    .split(/\s+/)
    .map(searchText)
    .filter(Boolean);
  const text = searchText(fields.join(" "));
  return words.every((word) => text.includes(word));
}
export function catalogSearch(query: string) {
  const matches = shoes.filter((s) =>
    matchesQuery(query, [s.name, s.brand, s.color, s.article]),
  );
  const tracked = matches.filter((s) => trackedStores(s.id).length > 0);
  const preview = matches.filter((s) => trackedStores(s.id).length === 0);
  const pending = requests.filter(
    (r) =>
      !("shoeId" in r && r.shoeId) &&
      matchesQuery(query, [
        r.referenceModel,
        r.referenceColor,
        r.referenceArticle ?? "",
        "suppliedIdentifier" in r && typeof r.suppliedIdentifier === "string"
          ? r.suppliedIdentifier
          : "",
      ]),
  );
  return { tracked, preview, pending };
}
export function catalogLabel(shoe: Shoe) {
  const stores = trackedStores(shoe.id);
  return stores.length
    ? `Tracking ${stores.length} verified ${stores.length === 1 ? "store" : "stores"}`
    : "Design preview · no verified live price";
}
