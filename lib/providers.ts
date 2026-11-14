import { safeRetailerUrl, freshness } from "./comparison";
export type Listing = {
  id: string;
  name: string;
  brand: string;
  price: number;
  retailer: "Myntra" | "Nykaa Fashion";
  url: string;
  sizeStatus: "unconfirmed";
  observedAt: string | null;
};
export function normalizeProducts(
  data: unknown,
  retailer: Listing["retailer"],
): Listing[] {
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  if (!Array.isArray(record.products)) return [];
  // Search-level sizes are not proof of size-specific stock or price.
  const observedAt =
    typeof record.fetched_at === "string" &&
    Number.isFinite(Date.parse(record.fetched_at))
      ? record.fetched_at
      : null;
  if (observedAt && freshness(observedAt) === "expired") return [];
  return record.products.slice(0, 12).flatMap((p: Record<string, unknown>) => {
    if (!p || typeof p !== "object") return [];
    const url = safeRetailerUrl(p.url, retailer);
    if (
      !url ||
      typeof p.name !== "string" ||
      typeof p.price !== "number" ||
      !Number.isFinite(p.price) ||
      p.price <= 0 ||
      (p.currency && p.currency !== "INR") ||
      p.in_stock === false
    )
      return [];
    return [
      {
        id: `${retailer}-${String(p.id)}`,
        name: p.name.slice(0, 200),
        brand: typeof p.brand === "string" ? p.brand : "",
        price: p.price,
        retailer,
        url,
        sizeStatus: "unconfirmed" as const,
        observedAt,
      },
    ];
  });
}
export async function searchProvider(
  retailer: Listing["retailer"],
  query: string,
  key: string,
) {
  const path = retailer === "Myntra" ? "myntra" : "nykaafashion";
  const url = new URL(`https://api.api.sh/${path}/v1/search`);
  url.searchParams.set("q", query);
  const res = await fetch(url, {
    headers: { "x-api-key": key },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Retailer lookup unavailable");
  return normalizeProducts(await res.json(), retailer);
}
