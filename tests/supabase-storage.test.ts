import { test } from "node:test";
import assert from "node:assert/strict";
import { readObservations, saveObservations } from "../lib/storage";
import { observation } from "./fixtures";
test("Supabase adapter sends all variants, preserves null sizes and hides fixtures in production", async () => {
  const previous = process.env,
    originalFetch = globalThis.fetch;
  process.env = {
    ...previous,
    NODE_ENV: "production",
    SUPABASE_URL: "https://fixture.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "fixture",
    SHOW_TEST_FIXTURES: "1",
  };
  const rows = [
    observation("samba-og", { fixture: false }),
    observation("samba-og", {
      fixture: false,
      size: null,
      variantId: "legacy",
    }),
  ];
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.hostname, "fixture.supabase.co");
    assert.ok(!url.href.includes("apikey"));
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      assert.equal(body.length, 2);
      assert.equal(body[1].size_uk, null);
      assert.equal(body[0].payload.variantId, rows[0].variantId);
      assert.equal((init.headers as Record<string, string>).apikey, "fixture");
      return new Response(null, { status: 201 });
    }
    assert.equal(url.searchParams.get("fixture"), "eq.false");
    assert.equal(url.searchParams.get("shoe_id"), "eq.samba-og");
    return Response.json([
      ...rows.map((payload) => ({ payload })),
      { payload: observation("samba-og", { fixture: true }) },
    ]);
  };
  try {
    await saveObservations(rows);
    const result = await readObservations("samba-og");
    assert.equal(result.length, 2);
    assert.ok(result.every((r) => !r.fixture));
    assert.equal(result[1].size, null);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = previous;
  }
});
