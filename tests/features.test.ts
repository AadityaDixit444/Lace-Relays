import { test } from "node:test";
import assert from "node:assert/strict";
import { shoes } from "../lib/catalog";
import {
  browseShoes,
  sizeTax,
  historyGrid,
  identityFor,
  currentRows,
} from "../lib/observations";
import { parseFilters, filterQuery } from "../lib/browse-state";
import { journeyFixtures, observation } from "./fixtures";
const now = Date.parse("2026-11-14T10:00:00Z"),
  identity = identityFor(shoes[0]),
  rows = journeyFixtures(now);
test("Terrace OR Skate is deduplicated; height, exact size and budget are AND filters", () => {
  const f = parseFilters(
    new URLSearchParams("looks=terrace,skate&height=Low&size=7&budget=6000"),
  );
  assert.deepEqual(
    browseShoes([...shoes, shoes[0]], rows, f, now).map((s) => s.id),
    ["palermo", "old-skool"],
  );
  assert.equal(
    browseShoes(shoes, rows, { ...f, budgetPaise: 800000 }, now).filter(
      (s) => s.id === "samba-og",
    ).length,
    1,
  );
  assert.equal(
    browseShoes(shoes, rows, { ...f, height: "High" }, now).length,
    0,
  );
  assert.equal(
    browseShoes(
      shoes,
      [observation("samba-og", { size: 4, pricePaise: 499900 })],
      f,
      now,
    ).length,
    0,
  );
  assert.equal(browseShoes(shoes, rows, { ...f, size: 7.5 }, now).length, 2);
  assert.deepEqual(parseFilters(new URLSearchParams(filterQuery(f))), f);
});
test("Size Tax ignores sold out, unknown, ambiguous, foreign, conditional and expired prices", () => {
  const polluted = [
    ...rows,
    observation("samba-og", { size: null, pricePaise: 100 }),
    observation("samba-og", {
      variantId: "conditional",
      priceType: "conditional",
      pricePaise: 100,
    }),
    observation("samba-og", {
      variantId: "ambiguous",
      match: "ambiguous",
      pricePaise: 100,
    }),
    observation("samba-og", {
      variantId: "expired",
      size: 6,
      observedAt: new Date(now - 48 * 3600000).toISOString(),
      pricePaise: 100,
    }),
    observation("samba-og", {
      variantId: "kids",
      range: "kids",
      pricePaise: 100,
    }),
    observation("samba-og", {
      variantId: "usd",
      currency: "USD",
      pricePaise: 100,
    }),
  ];
  const tax = sizeTax(polluted, identity, 7, now);
  assert.equal(tax.status, "available");
  if (tax.status === "available") {
    assert.equal(tax.differencePaise, 200000);
    assert.equal(tax.benchmarks[0].size, 4);
  }
  assert.equal(sizeTax(polluted, identity, 12, now).status, "unavailable");
  const tied = [
    observation(),
    observation("samba-og", { variantId: "4", size: 4 }),
  ];
  const tie = sizeTax(tied, identity, 7, now);
  assert.equal(tie.status === "available" && tie.differencePaise, 0);
  assert.equal(sizeTax([observation()], identity, 7, now).status, "one-size");
});
test("latest sold-out evidence removes old stock, without erasing historical lows", () => {
  const older = observation();
  const newer = {
    ...older,
    id: "sold",
    observedAt: new Date(now - 1000).toISOString(),
    stock: "out_of_stock" as const,
  };
  assert.equal(sizeTax([older, newer], identity, 7, now).status, "unavailable");
  assert.equal(
    historyGrid([older, newer], identity, [7], "2026-11-14", "2026-11-14")[0]
      .pricePaise,
    799900,
  );
});
test("history uses India days, retains missing gaps, distinguishes sold out and permits one point", () => {
  const data = [
    observation("samba-og", {
      observedAt: "2026-11-11T20:00:00Z",
      pricePaise: 700000,
    }),
    observation("samba-og", {
      id: "best",
      retailer: "Nykaa Fashion",
      observedAt: "2026-11-12T03:00:00Z",
      pricePaise: 650000,
    }),
    observation("samba-og", {
      id: "sold",
      observedAt: "2026-11-14T03:00:00Z",
      stock: "out_of_stock",
    }),
  ];
  const grid = historyGrid(data, identity, [7, 8], "2026-11-12", "2026-11-14");
  assert.equal(grid[0].pricePaise, 650000);
  assert.equal(grid[0].evidence[0].retailer, "Nykaa Fashion");
  assert.equal(grid.filter((c) => c.status === "priced").length, 1);
  assert.equal(
    grid.find((c) => c.day === "2026-11-13" && c.size === 7)?.status,
    "no_observation",
  );
  assert.equal(
    grid.find((c) => c.day === "2026-11-14" && c.size === 7)?.status,
    "sold_out",
  );
  assert.equal(
    currentRows(data, identity, now).some(
      (r) => r.observedAt === "2026-11-11T20:00:00Z",
    ),
    false,
  );
});
