import { shoes } from "../lib/catalog";
import { identityFor, type Observation } from "../lib/observations";
// Test-only data. Never imported by application code.
export function observation(
  shoeId = "samba-og",
  overrides: Partial<Observation> = {},
  now = Date.parse("2026-11-14T10:00:00Z"),
): Observation {
  const shoe = shoes.find((s) => s.id === shoeId)!;
  return {
    ...identityFor(shoe),
    id: `fixture-${shoeId}-7`,
    listingId: `fixture-${shoeId}`,
    variantId: `fixture-${shoeId}-7`,
    retailer: "Myntra",
    pricePaise: 799900,
    currency: "INR",
    size: 7,
    stock: "in_stock",
    observedAt: new Date(now - 3600000).toISOString(),
    retrievedAt: new Date(now - 3600000).toISOString(),
    priceType: "ordinary",
    match: "exact",
    url: "https://www.myntra.com/1/buy",
    fixture: true,
    ...overrides,
  };
}
export function journeyFixtures(now = Date.now()): Observation[] {
  const rows: Observation[] = [];
  for (const id of ["samba-og", "palermo", "old-skool"]) {
    for (const [size, price] of [
      [3, 4499],
      [4, id === "samba-og" ? 5999 : 3999],
      [7, id === "samba-og" ? 7999 : 5499],
      [7.5, id === "samba-og" ? 7499 : 5799],
      [8, 6499],
    ]) {
      const row = observation(
        id,
        {
          id: `fixture-${id}-${size}`,
          variantId: `fixture-${id}-${size}`,
          size,
          pricePaise: price * 100,
          stock: size === 3 ? "out_of_stock" : "in_stock",
        },
        now,
      );
      rows.push(row);
      if (size === 7 || size === 8) {
        rows.push({
          ...row,
          id: `${row.id}-old`,
          observedAt: new Date(now - 4 * 86400000).toISOString(),
          pricePaise: row.pricePaise + 50000,
        });
        rows.push({
          ...row,
          id: `${row.id}-sold`,
          observedAt: new Date(now - 2 * 86400000).toISOString(),
          stock: "out_of_stock",
        });
      }
    }
  }
  return rows;
}
