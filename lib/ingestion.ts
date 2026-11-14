import { createHash } from "node:crypto";
import { safeRetailerUrl, freshness } from "./comparison";
import {
  identityFor,
  sameIdentity,
  type Identity,
  type Observation,
} from "./observations";
import type { Shoe } from "./catalog";
import type { Listing } from "./providers";
export type Binding = Identity & {
  retailer: Listing["retailer"];
  listingId: string;
  sizeSystem: "UK" | null;
  verified: boolean;
};
export function parseUkSize(value: unknown, system: "UK" | null) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  const m =
    text.match(/^UK\s*(\d+(?:\.5)?)$/i) ??
    (system === "UK" ? text.match(/^(\d+(?:\.5)?)$/) : null);
  const size = m ? Number(m[1]) : NaN;
  return size >= 3 && size <= 12 && (size * 2) % 1 === 0 ? size : null;
}
export function normalizeDetail(
  data: unknown,
  binding: Binding,
  shoe: Shoe,
  retrievedAt = new Date().toISOString(),
): { rows: Observation[]; limitation: string | null } {
  if (!binding.verified || !sameIdentity(binding, identityFor(shoe)))
    return {
      rows: [],
      limitation:
        "Exact article, colourway, edition and range are not verified.",
    };
  if (!data || typeof data !== "object")
    return { rows: [], limitation: "Invalid product details." };
  const raw = data as Record<string, unknown>;
  const normalizeCode = (v: string) =>
    v.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const claimedArticle = raw.article_code ?? raw.articleCode;
  if (
    typeof claimedArticle === "string" &&
    normalizeCode(claimedArticle) !== normalizeCode(binding.article)
  )
    return {
      rows: [],
      limitation: "Source article contradicts the verified mapping.",
    };
  if (
    typeof raw.brand === "string" &&
    normalizeCode(raw.brand) !== normalizeCode(binding.brand)
  )
    return {
      rows: [],
      limitation: "Source brand contradicts the verified mapping.",
    };
  if (String(raw.id) !== binding.listingId)
    return { rows: [], limitation: "Retailer listing identity changed." };
  const url = safeRetailerUrl(raw.url, binding.retailer);
  if (!url) return { rows: [], limitation: "Invalid retailer product URL." };
  const sourceTime =
    typeof raw.fetched_at === "string" &&
    Number.isFinite(Date.parse(raw.fetched_at))
      ? raw.fetched_at
      : null;
  // Without source time a cached response cannot be assigned a new observation time.
  if (raw.cached === true && !sourceTime)
    return {
      rows: [],
      limitation:
        "Cached product has no source observation time; not recorded again.",
    };
  const time = sourceTime ?? retrievedAt;
  if (Date.parse(time) > Date.parse(retrievedAt))
    return { rows: [], limitation: "Invalid future source timestamp." };
  const variants =
    Array.isArray(raw.sizes) && raw.sizes.length ? raw.sizes : [null];
  const rows: Observation[] = [];
  for (const item of variants) {
    const v =
      item && typeof item === "object"
        ? (item as Record<string, unknown>)
        : null;
    const label = v?.label ?? v?.size ?? item;
    const size = v ? parseUkSize(label, binding.sizeSystem) : null;
    // Never assign model-level prices to a size when no per-size price is supplied.
    const price = v?.price ?? (size === null ? raw.price : undefined);
    if (
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isSafeInteger(Math.round(price * 100))
    )
      continue;
    const available = v?.available ?? v?.in_stock;
    const stock =
      available === true
        ? "in_stock"
        : available === false
          ? "out_of_stock"
          : "unknown";
    const variantId = String(
      v?.sku ?? v?.id ?? `${binding.listingId}:${label ?? "unknown"}`,
    );
    const row: Observation = {
      ...identityFor(shoe),
      id: "",
      listingId: binding.listingId,
      variantId,
      retailer: binding.retailer,
      size,
      pricePaise: Math.round(price * 100),
      currency: typeof raw.currency === "string" ? raw.currency : "unknown",
      stock,
      observedAt: time,
      retrievedAt,
      priceType:
        raw.price_type === "conditional" || v?.price_type === "conditional"
          ? "conditional"
          : "ordinary",
      match: "exact",
      url,
      fixture: false,
    };
    row.id = createHash("sha256")
      .update(JSON.stringify([row.shoeId, row.retailer, variantId, size, time]))
      .digest("hex");
    rows.push(row);
  }
  return {
    rows,
    limitation: rows.some(
      (r) => r.size !== null && r.stock !== "unknown" && r.currency === "INR",
    )
      ? null
      : "Source has no confirmed UK-size price and stock evidence.",
  };
}
export async function fetchDetail(binding: Binding, key: string) {
  const provider = binding.retailer === "Myntra" ? "myntra" : "nykaafashion";
  const url = new URL(`https://api.api.sh/${provider}/v1/product`);
  url.searchParams.set("id", binding.listingId);
  const response = await fetch(url, {
    headers: { "x-api-key": key },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Retailer timed out or was unavailable");
  return response.json();
}
export async function refreshShoe(
  shoe: Shoe,
  bindings: Binding[],
  prior: Observation[],
  key: string,
  persist: (rows: Observation[]) => Promise<void>,
  now = Date.now(),
) {
  const sources = await Promise.all(
    bindings
      .filter((b) => b.shoeId === shoe.id)
      .map(async (binding) => {
        if (!binding.verified || !sameIdentity(binding, identityFor(shoe)))
          return {
            retailer: binding.retailer,
            status: "unverified",
            limitation: "Canonical identity has not been verified.",
          };
        const previous = prior.filter(
          (r) =>
            r.retailer === binding.retailer &&
            r.listingId === binding.listingId &&
            sameIdentity(r, binding),
        );
        const latest = previous.reduce(
          (a, r) => Math.max(a, Date.parse(r.observedAt)),
          0,
        );
        if (latest && now - latest < 24 * 3600000)
          return {
            retailer: binding.retailer,
            status: "cached",
            limitation: null,
          };
        try {
          const { rows, limitation } = normalizeDetail(
            await fetchDetail(binding, key),
            binding,
            shoe,
            new Date(now).toISOString(),
          );
          await persist(rows);
          return {
            retailer: binding.retailer,
            status: rows.length ? "checked" : "no_evidence",
            limitation,
          };
        } catch {
          return {
            retailer: binding.retailer,
            status:
              latest &&
              freshness(new Date(latest).toISOString(), now) !== "expired"
                ? "stale"
                : "failed",
            limitation:
              "Refresh failed. Existing source timestamps are preserved.",
          };
        }
      }),
  );
  return sources;
}
