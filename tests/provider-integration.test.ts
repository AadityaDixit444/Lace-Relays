import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "../app/api/search/route";

test("live search accepts partial results, coalesces identical requests and caches results", async () => {
  const originalFetch = globalThis.fetch;
  const previous = {
    key: process.env.APISH_KEY,
    token: process.env.PILOT_ACCESS_TOKEN,
  };
  process.env.APISH_KEY = "fixture";
  process.env.PILOT_ACCESS_TOKEN = "fixture";
  let calls = 0;
  globalThis.fetch = async (input) => {
    calls++;
    const url = String(input);
    assert.ok(url.startsWith("https://api.api.sh/"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    if (url.includes("/nykaafashion/"))
      return new Response("{}", { status: 503 });
    return Response.json({
      products: [
        {
          id: 1,
          name: "Nike fixture model",
          brand: "Nike",
          price: 6995,
          in_stock: true,
          url: "https://www.myntra.com/1/buy",
        },
      ],
    });
  };
  const request = (q: string) =>
    new NextRequest("http://localhost/api/search", {
      method: "POST",
      headers: {
        Authorization: "Bearer fixture",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q }),
    });
  try {
    const replies = await Promise.all([
      POST(request("Nike fixture model")),
      POST(request("Nike fixture model")),
    ]);
    for (const reply of replies) {
      assert.equal(reply.status, 200);
      const body = await reply.json();
      assert.equal(body.listings.length, 1);
      assert.equal(body.listings[0].sizeStatus, "unconfirmed");
      assert.deepEqual(
        body.sources.map((s: { status: string }) => s.status),
        ["checked", "failed"],
      );
    }
    assert.equal(calls, 2);
    const cached = await POST(request("Nike fixture model"));
    assert.equal((await cached.json()).cached, true);
    assert.equal(calls, 2);
    globalThis.fetch = async () => {
      throw new Error("sensitive upstream details must not leak");
    };
    const failed = await POST(request("Another fixture model"));
    assert.equal(failed.status, 502);
    assert.ok(!(await failed.text()).includes("sensitive upstream"));
  } finally {
    globalThis.fetch = originalFetch;
    if (previous.key === undefined) delete process.env.APISH_KEY;
    else process.env.APISH_KEY = previous.key;
    if (previous.token === undefined) delete process.env.PILOT_ACCESS_TOKEN;
    else process.env.PILOT_ACCESS_TOKEN = previous.token;
  }
});
