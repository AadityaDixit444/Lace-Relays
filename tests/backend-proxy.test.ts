import { test } from "node:test";
import assert from "node:assert/strict";
import { backendProxy } from "../lib/backend-proxy";
test("Next routes fail closed and proxy requests without provider secrets", async () => {
  const previous = process.env.LACERELAY_API_URL,
    originalFetch = globalThis.fetch;
  try {
    delete process.env.LACERELAY_API_URL;
    assert.equal((await backendProxy("/catalog")).status, 503);
    process.env.LACERELAY_API_URL = "http://evil.test";
    assert.equal((await backendProxy("/catalog")).status, 503);
    process.env.LACERELAY_API_URL = "https://api.example.test";
    let calls = 0;
    globalThis.fetch = async (input, init) => {
      calls++;
      assert.equal(String(input), "https://api.example.test/search");
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers.Authorization, "Bearer fixture");
      assert.ok(!("x-api-key" in headers));
      assert.deepEqual(JSON.parse(String(init?.body)), { q: "Samba" });
      return Response.json({ listings: [] });
    };
    assert.equal(
      (
        await backendProxy(
          "/search",
          new Request("http://localhost/api/search", {
            method: "POST",
            headers: { Authorization: "Bearer fixture" },
            body: JSON.stringify({ q: "Samba" }),
          }),
        )
      ).status,
      200,
    );
    assert.equal(calls, 1);
    assert.equal(
      (
        await backendProxy(
          "/search",
          new Request("http://localhost/api/search", {
            method: "POST",
            body: "x".repeat(3000),
          }),
        )
      ).status,
      413,
    );
    assert.equal(calls, 1);
    globalThis.fetch = async () => {
      throw new Error("sensitive internal exception");
    };
    const failed = await backendProxy("/catalog");
    assert.equal(failed.status, 502);
    assert.ok(!(await failed.text()).includes("sensitive internal"));
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.LACERELAY_API_URL;
    else process.env.LACERELAY_API_URL = previous;
  }
});
