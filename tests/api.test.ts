import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "../app/api/search/route";
test("live API fails closed, authenticates, and validates requests", async () => {
  const previous = {
    key: process.env.APISH_KEY,
    token: process.env.PILOT_ACCESS_TOKEN,
  };
  const request = (body: string, authorized = false) =>
    new NextRequest("http://localhost/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authorized ? { Authorization: "Bearer fixture" } : {}),
      },
      body,
    });
  try {
    delete process.env.APISH_KEY;
    delete process.env.PILOT_ACCESS_TOKEN;
    assert.equal((await POST(request("{}"))).status, 503);
    process.env.APISH_KEY = "fixture";
    process.env.PILOT_ACCESS_TOKEN = "fixture";
    assert.equal((await POST(request('{"q":"Samba"}'))).status, 401);
    for (const body of [
      "{",
      "null",
      "{}",
      '{"q":"ab"}',
      '{"q":"<script>"}',
      JSON.stringify({ q: "a".repeat(101) }),
    ])
      assert.equal((await POST(request(body, true))).status, 400);
    assert.equal(
      (await POST(request(JSON.stringify({ q: "a".repeat(3000) }), true)))
        .status,
      400,
    );
  } finally {
    if (previous.key === undefined) delete process.env.APISH_KEY;
    else process.env.APISH_KEY = previous.key;
    if (previous.token === undefined) delete process.env.PILOT_ACCESS_TOKEN;
    else process.env.PILOT_ACCESS_TOKEN = previous.token;
  }
});
