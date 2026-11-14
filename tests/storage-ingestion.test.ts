import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  saveObservations,
  readObservations,
  observationId,
} from "../lib/storage";
import { normalizeDetail, refreshShoe, type Binding } from "../lib/ingestion";
import { identityFor } from "../lib/observations";
import { shoes } from "../lib/catalog";
import { observation } from "./fixtures";
const now = Date.parse("2026-11-14T10:00:00Z");
const binding: Binding = {
  ...identityFor(shoes[0]),
  retailer: "Myntra",
  listingId: "1",
  sizeSystem: "UK",
  verified: true,
};
const payload = {
  id: 1,
  url: "https://www.myntra.com/1/buy",
  currency: "INR",
  cached: true,
  fetched_at: "2026-11-14T09:00:00Z",
  sizes: [
    { label: "UK 7", sku: "7", price: 7999, available: true },
    { label: "8", sku: "8", price: 6999, available: true },
    { label: "7.5", sku: "7.5", price: 7499, available: true },
    { label: "EU 42", sku: "unknown", price: 6000, available: true },
    { label: "3", sku: "3", price: 4999, available: false },
  ],
};
test("detail normalization records all supplied sizes, preserves unknown, does not infer price", () => {
  const { rows } = normalizeDetail(
    payload,
    binding,
    shoes[0],
    new Date(now).toISOString(),
  );
  assert.deepEqual(
    rows.map((r) => r.size),
    [7, 8, 7.5, null, 3],
  );
  assert.equal(rows[4].stock, "out_of_stock");
  assert.equal(rows[0].pricePaise, 799900);
  assert.equal(
    normalizeDetail(
      { ...payload, sizes: [{ label: "7", available: true }], price: 4999 },
      binding,
      shoes[0],
    ).rows.length,
    0,
  );
  assert.equal(
    normalizeDetail({ ...payload, fetched_at: undefined }, binding, shoes[0])
      .rows.length,
    0,
  );
  assert.equal(
    normalizeDetail(payload, { ...binding, range: "kids" }, shoes[0]).rows
      .length,
    0,
  );
});
test("durable SQLite history survives reopening, cache rereads deduplicate, legacy unknown stays unknown", async () => {
  const dir = mkdtempSync(join(tmpdir(), "lacerelay-storage-"));
  const previous = {
    path: process.env.LACERELAY_DB_PATH,
    fixtures: process.env.SHOW_TEST_FIXTURES,
  };
  process.env.LACERELAY_DB_PATH = join(dir, "observations.sqlite");
  process.env.SHOW_TEST_FIXTURES = "1";
  try {
    const parsed = normalizeDetail(
      payload,
      binding,
      shoes[0],
      new Date(now).toISOString(),
    ).rows;
    const unknown = observation("samba-og", {
      size: null,
      variantId: "legacy",
    });
    await saveObservations([...parsed, unknown]);
    await saveObservations(
      parsed.map((r) => ({
        ...r,
        retrievedAt: new Date(now + 60000).toISOString(),
      })),
    );
    const result = await readObservations("samba-og");
    assert.equal(result.length, 6);
    assert.equal(result.find((r) => r.variantId === "legacy")?.size, null);
    assert.equal(new Set(result.map(observationId)).size, 6);
    delete process.env.SHOW_TEST_FIXTURES;
    assert.equal(
      (await readObservations()).some((r) => r.fixture),
      false,
    );
  } finally {
    if (previous.path === undefined) delete process.env.LACERELAY_DB_PATH;
    else process.env.LACERELAY_DB_PATH = previous.path;
    if (previous.fixtures === undefined) delete process.env.SHOW_TEST_FIXTURES;
    else process.env.SHOW_TEST_FIXTURES = previous.fixtures;
    for (const suffix of ["", "-wal", "-shm"])
      rmSync(join(dir, "observations.sqlite" + suffix), { force: true });
    rmdirSync(dir);
  }
});
test("under 24h reuses data, stale refresh persists all sizes, and retailer timeout preserves prior records", async () => {
  const original = globalThis.fetch;
  let fetches = 0,
    persisted = 0;
  const prior = normalizeDetail(
    payload,
    binding,
    shoes[0],
    new Date(now).toISOString(),
  ).rows;
  globalThis.fetch = async () => {
    fetches++;
    return Response.json(payload);
  };
  try {
    await refreshShoe(
      shoes[0],
      [binding],
      prior,
      "fixture",
      async (rows) => {
        persisted += rows.length;
      },
      now,
    );
    assert.equal(fetches, 0);
    await refreshShoe(
      shoes[0],
      [binding],
      prior,
      "fixture",
      async (rows) => {
        persisted += rows.length;
      },
      now + 23 * 3600000,
    );
    assert.equal(fetches, 1);
    assert.equal(persisted, 5);
    globalThis.fetch = async () => {
      throw new Error("timeout");
    };
    const result = await refreshShoe(
      shoes[0],
      [binding],
      prior,
      "fixture",
      async () => {
        throw new Error("must not write");
      },
      now + 25 * 3600000,
    );
    assert.equal(result[0].status, "stale");
    assert.equal(prior[0].observedAt, payload.fetched_at);
  } finally {
    globalThis.fetch = original;
  }
});
