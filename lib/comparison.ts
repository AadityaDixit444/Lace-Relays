export type Offer = {
  id: string;
  retailer: string;
  pricePaise: number;
  size: number | null;
  stock: "in_stock" | "out_of_stock" | "unknown";
  observedAt: string;
  priceType: "ordinary" | "conditional";
  url: string;
};
export function freshness(
  observedAt: string,
  now = Date.now(),
): "fresh" | "stale" | "expired" {
  const age = now - Date.parse(observedAt);
  if (!Number.isFinite(age) || age < 0 || age >= 48 * 3600000) return "expired";
  return age < 24 * 3600000 ? "fresh" : "stale";
}
export function compareOffers(offers: Offer[], size: number, now = Date.now()) {
  const current = offers.filter(
    (o) =>
      freshness(o.observedAt, now) !== "expired" &&
      Number.isInteger(o.pricePaise) &&
      o.pricePaise > 0 &&
      o.stock !== "out_of_stock",
  );
  const confirmed = current
    .filter(
      (o) =>
        o.size === size && o.stock === "in_stock" && o.priceType === "ordinary",
    )
    .sort((a, b) => a.pricePaise - b.pricePaise);
  return {
    confirmed,
    winners: confirmed.filter((o) => o.pricePaise === confirmed[0]?.pricePaise),
    unconfirmed: current
      .filter(
        (o) =>
          (o.size === null || (o.size === size && o.stock === "unknown")) &&
          o.priceType === "ordinary",
      )
      .sort((a, b) => a.pricePaise - b.pricePaise),
    conditional: current.filter(
      (o) =>
        o.priceType === "conditional" && (o.size === null || o.size === size),
    ),
  };
}
export function safeRetailerUrl(
  value: unknown,
  retailer: "Myntra" | "Nykaa Fashion",
) {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    const allowed =
      retailer === "Myntra"
        ? ["www.myntra.com", "myntra.com"]
        : ["www.nykaafashion.com", "nykaafashion.com"];
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      allowed.includes(u.hostname)
      ? u.href
      : null;
  } catch {
    return null;
  }
}
