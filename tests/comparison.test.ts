import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareOffers,
  freshness,
  safeRetailerUrl,
  type Offer,
} from "../lib/comparison";
const now = Date.parse("2026-11-14T10:00:00Z");
const base: Offer = {
  id: "a",
  retailer: "One",
  pricePaise: 849900,
  size: 7,
  stock: "in_stock",
  observedAt: new Date(now - 3600000).toISOString(),
  priceType: "ordinary",
  url: "https://www.myntra.com/a",
};
test("cheaper unknown size cannot beat confirmed stock", () => {
  const r = compareOffers(
    [base, { ...base, id: "b", size: null, pricePaise: 799900 }],
    7,
    now,
  );
  assert.equal(r.winners[0].id, "a");
  assert.equal(r.unconfirmed[0].id, "b");
});
test("all tied winners are preserved", () => {
  assert.equal(
    compareOffers([base, { ...base, id: "b" }], 7, now).winners.length,
    2,
  );
});
test("sold out, wrong size, invalid and conditional prices never win", () => {
  const r = compareOffers(
    [
      { ...base, stock: "out_of_stock" },
      { ...base, size: 6 },
      { ...base, pricePaise: -10 },
      { ...base, priceType: "conditional" },
    ],
    7,
    now,
  );
  assert.equal(r.winners.length, 0);
  assert.equal(r.conditional.length, 1);
});
test("24h and 48h boundaries, invalid and future observations", () => {
  assert.equal(
    freshness(new Date(now - 24 * 3600000).toISOString(), now),
    "stale",
  );
  assert.equal(
    freshness(new Date(now - 48 * 3600000).toISOString(), now),
    "expired",
  );
  assert.equal(freshness("garbage", now), "expired");
  assert.equal(freshness(new Date(now + 1000).toISOString(), now), "expired");
  assert.equal(
    compareOffers(
      [{ ...base, observedAt: new Date(now - 48 * 3600000).toISOString() }],
      7,
      now,
    ).winners.length,
    0,
  );
});
test("half sizes do not round", () => {
  assert.equal(
    compareOffers([{ ...base, size: 7.5 }], 7.5, now).winners.length,
    1,
  );
  assert.equal(
    compareOffers([{ ...base, size: 7.5 }], 7, now).winners.length,
    0,
  );
});
test("unsafe retailer URLs are rejected", () => {
  for (const url of [
    "javascript:alert(1)",
    "https://www.myntra.com.evil.test/x",
    "https://www.myntra.com@evil.test",
    "http://www.myntra.com/a",
    "https://user:pass@www.myntra.com/a",
  ])
    assert.equal(safeRetailerUrl(url, "Myntra"), null);
  assert.ok(safeRetailerUrl("https://www.myntra.com/123/buy", "Myntra"));
});
