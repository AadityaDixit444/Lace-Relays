import { freshness, compareOffers, type Offer } from "./comparison";
import type { Shoe } from "./catalog";
import type { StyleId, Height } from "./styles";
export type Identity = {
  shoeId: string;
  brand: string;
  article: string;
  color: string;
  edition: string;
  range: "adult" | "kids";
};
export type Observation = Offer &
  Identity & {
    listingId: string;
    variantId: string;
    currency: string;
    match: "exact" | "ambiguous";
    retrievedAt: string;
    fixture: boolean;
  };
export const identityFor = (s: Shoe): Identity => ({
  shoeId: s.id,
  brand: s.brand,
  article: s.article,
  color: s.color,
  edition: s.edition,
  range: s.range,
});
export function sameIdentity(a: Identity, b: Identity) {
  return (
    ["shoeId", "brand", "article", "color", "edition", "range"] as const
  ).every((k) => a[k] === b[k]);
}
export function exactRows(rows: Observation[], identity: Identity) {
  return rows.filter(
    (r) =>
      sameIdentity(r, identity) && r.match === "exact" && r.currency === "INR",
  );
}
// Choose the latest evidence per retailer variant and size BEFORE considering stock.
// A later sold-out observation must invalidate an older in-stock observation.
export function latestRows(rows: Observation[]) {
  const map = new Map<string, Observation>();
  for (const r of rows) {
    const key = JSON.stringify([r.retailer, r.variantId, r.size]);
    const prior = map.get(key);
    if (
      !prior ||
      Date.parse(r.observedAt) > Date.parse(prior.observedAt) ||
      (r.observedAt === prior.observedAt && r.stock === "out_of_stock")
    )
      map.set(key, r);
  }
  return [...map.values()];
}
export function currentRows(
  rows: Observation[],
  identity: Identity,
  now = Date.now(),
) {
  return latestRows(exactRows(rows, identity)).filter(
    (r) => freshness(r.observedAt, now) !== "expired",
  );
}
export function sizePrices(
  rows: Observation[],
  identity: Identity,
  now = Date.now(),
) {
  const current = currentRows(rows, identity, now);
  const sizes = [
    ...new Set(current.flatMap((r) => (r.size === null ? [] : [r.size]))),
  ].sort((a, b) => a - b);
  return sizes.flatMap((size) => {
    const winners = compareOffers(current, size, now).winners;
    return winners.length
      ? [{ size, pricePaise: winners[0].pricePaise, offers: winners }]
      : [];
  });
}
export function sizeTax(
  rows: Observation[],
  identity: Identity,
  size: number,
  now = Date.now(),
) {
  const prices = sizePrices(rows, identity, now),
    mine = prices.find((p) => p.size === size);
  if (!mine) return { status: "unavailable" as const };
  if (prices.length === 1) return { status: "one-size" as const, mine };
  const lowest = Math.min(...prices.map((p) => p.pricePaise));
  return {
    status: "available" as const,
    mine,
    benchmarks: prices.filter((p) => p.pricePaise === lowest),
    differencePaise: mine.pricePaise - lowest,
  };
}
export type BrowseFilters = {
  styles: StyleId[];
  height: Height | "";
  size: number | null;
  budgetPaise: number | null;
};
export function browseShoes(
  catalog: Shoe[],
  rows: Observation[],
  filters: BrowseFilters,
  now = Date.now(),
) {
  return [...new Map(catalog.map((s) => [s.id, s])).values()].filter((s) => {
    if (
      s.category !== "Sneakers" ||
      (filters.styles.length &&
        !s.styles.some((t) => filters.styles.includes(t))) ||
      (filters.height && s.height !== filters.height)
    )
      return false;
    if (filters.size === null && filters.budgetPaise === null) return true;
    const prices = sizePrices(rows, identityFor(s), now).filter(
      (p) => filters.size === null || p.size === filters.size,
    );
    return prices.some(
      (p) =>
        filters.budgetPaise === null || p.pricePaise <= filters.budgetPaise,
    );
  });
}
export const indiaDay = (time: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(time));
export type HistoryCell = {
  day: string;
  size: number;
  status: "priced" | "sold_out" | "no_observation";
  pricePaise: number | null;
  evidence: Observation[];
};
export function historyGrid(
  rows: Observation[],
  identity: Identity,
  sizes: number[],
  from: string,
  to: string,
): HistoryCell[] {
  const eligible = exactRows(rows, identity).filter(
    (r) =>
      r.size !== null &&
      r.priceType === "ordinary" &&
      Number.isSafeInteger(r.pricePaise) &&
      r.pricePaise > 0 &&
      Number.isFinite(Date.parse(r.observedAt)),
  );
  const cells: HistoryCell[] = [];
  for (
    let date = Date.parse(`${from}T00:00:00Z`);
    date <= Date.parse(`${to}T00:00:00Z`);
    date += 86400000
  ) {
    const day = new Date(date).toISOString().slice(0, 10);
    for (const size of sizes) {
      const observed = eligible.filter(
        (r) => r.size === size && indiaDay(r.observedAt) === day,
      );
      const stocked = observed.filter((r) => r.stock === "in_stock");
      const price = stocked.length
        ? Math.min(...stocked.map((r) => r.pricePaise))
        : null;
      cells.push({
        day,
        size,
        status:
          price !== null
            ? "priced"
            : observed.some((r) => r.stock === "out_of_stock")
              ? "sold_out"
              : "no_observation",
        pricePaise: price,
        evidence:
          price !== null
            ? stocked.filter((r) => r.pricePaise === price)
            : observed.filter((r) => r.stock === "out_of_stock"),
      });
    }
  }
  return cells;
}
