import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { searchProvider, type Listing } from "@/lib/providers";
export const runtime = "nodejs";
const cache = new Map<
  string,
  {
    at: number;
    listings: Listing[];
    sources: { retailer: string; status: string }[];
  }
>();
const pending = new Map<string, Promise<NextResponse>>();
const hour = 3600000;
export async function POST(req: NextRequest) {
  const key = process.env.APISH_KEY,
    token = process.env.PILOT_ACCESS_TOKEN;
  if (!key || !token)
    return NextResponse.json(
      {
        error:
          "Live search is not connected yet. Explore the labelled preview collection.",
      },
      { status: 503 },
    );
  const supplied =
    req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (
    Buffer.byteLength(supplied) !== Buffer.byteLength(token) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))
  )
    return NextResponse.json(
      { error: "A valid pilot access token is required." },
      { status: 401 },
    );
  if (Number(req.headers.get("content-length") ?? 0) > 2048)
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let body;
  try {
    const raw = await req.text();
    if (raw.length > 2048) throw new Error();
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const q =
    typeof body?.q === "string" ? body.q.trim().replace(/\s+/g, " ") : "";
  if (q.length < 3 || q.length > 100 || /[<>\x00-\x1f]/.test(q))
    return NextResponse.json(
      { error: "Enter a shoe name between 3 and 100 characters." },
      { status: 400 },
    );
  const name = q.toLowerCase(),
    saved = cache.get(name),
    now = Date.now();
  if (saved && now - saved.at < 24 * hour)
    return NextResponse.json({ ...saved, cached: true, mode: "live" });
  // A bounded per-instance pilot budget; use a durable gateway before public live access.
  if (cache.size >= 50 && !saved)
    return NextResponse.json(
      { error: "Pilot search capacity reached. Please try later." },
      { status: 429 },
    );
  if (pending.has(name)) return (await pending.get(name)!).clone();
  const job = (async () => {
    const retailers = ["Myntra", "Nykaa Fashion"] as const;
    const results = await Promise.allSettled(
      retailers.map((r) => searchProvider(r, q, key)),
    );
    const sources = results.map((r, i) => ({
      retailer: retailers[i],
      status:
        r.status === "rejected"
          ? "failed"
          : r.value.length
            ? "checked"
            : "no_matches",
    }));
    const listings = results.flatMap((r) =>
      r.status === "fulfilled" ? r.value : [],
    );
    if (results.every((r) => r.status === "rejected")) {
      if (saved && now - saved.at < 48 * hour)
        return NextResponse.json({
          ...saved,
          stale: true,
          mode: "live",
          sources,
        });
      return NextResponse.json(
        { error: "Both stores are unavailable. Please try again.", sources },
        { status: 502 },
      );
    }
    const value = { at: now, listings, sources };
    cache.set(name, value);
    return NextResponse.json({ ...value, mode: "live" });
  })();
  pending.set(name, job);
  try {
    return (await job).clone();
  } finally {
    pending.delete(name);
  }
}
