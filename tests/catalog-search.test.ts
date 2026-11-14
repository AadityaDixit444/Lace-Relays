import { test } from "node:test";
import assert from "node:assert/strict";
import {
  catalogSearch,
  catalogLabel,
  trackedStores,
} from "../lib/catalog-search";
import { shoes } from "../lib/catalog";

test("catalog search separates tracked pairs from previews and pending references", () => {
  const all = catalogSearch("");
  assert.equal(all.tracked.length, 4);
  assert.ok(all.preview.some((s) => s.id === "samba-og"));
  assert.deepEqual(
    all.pending.map((r) => r.query),
    ["PUMA McLaren Racing Speedcat"],
  );
  for (const s of all.tracked)
    assert.ok(!all.preview.some((p) => p.id === s.id));
  assert.deepEqual(trackedStores("asics-classic-ct-s-verdigris"), [
    "Nykaa Fashion",
    "ASICS India",
  ]);
  assert.match(
    catalogLabel(shoes.find((s) => s.id === "samba-og")!),
    /Design preview/,
  );
});

test("catalog matching supports unordered words, article punctuation and UK-size suffixes", () => {
  assert.deepEqual(
    catalogSearch("Precision Nike UK 7").tracked.map((s) => s.id),
    ["nike-precision-8-low-cactus"],
  );
  assert.deepEqual(
    catalogSearch("ih1104003").tracked.map((s) => s.id),
    ["nike-precision-8-low-cactus"],
  );
  assert.deepEqual(
    catalogSearch("IB7110-002 UK7").tracked.map((s) => s.id),
    ["air-jordan-1-mid-se-mango"],
  );
  assert.equal(catalogSearch("309452_01").pending.length, 1);
  assert.equal(catalogSearch("1624832").pending.length, 0);
  assert.equal(catalogSearch("1624832").tracked.length, 0);
  assert.equal(catalogSearch("no such shoe").tracked.length, 0);
});
