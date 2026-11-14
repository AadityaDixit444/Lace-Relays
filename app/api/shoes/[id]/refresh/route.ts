import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { shoes } from "@/lib/catalog";
import { refreshShoe, type Binding } from "@/lib/ingestion";
import {
  readObservations,
  saveObservations,
  storageStatus,
} from "@/lib/storage";
import bindings from "@/data/retailer-bindings.json";
export const runtime = "nodejs";
const pending = new Map<string, Promise<unknown>>();
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const shoe = shoes.find((s) => s.id === id);
  if (!shoe)
    return NextResponse.json({ error: "Unknown shoe" }, { status: 404 });
  const key = process.env.APISH_KEY,
    token = process.env.PILOT_ACCESS_TOKEN;
  if (!key || !token || storageStatus() === "unconfigured")
    return NextResponse.json(
      {
        error:
          "Live refresh requires provider credentials and persistent storage.",
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
      { error: "Invalid pilot access token." },
      { status: 401 },
    );
  const selected = (bindings as Binding[]).filter((b) => b.shoeId === id);
  if (!selected.length)
    return NextResponse.json(
      {
        error:
          "No verified retailer listing is connected for this exact colourway yet.",
      },
      { status: 503 },
    );
  let job = pending.get(id);
  try {
    if (!pending.has(id))
      pending.set(
        id,
        (async () =>
          refreshShoe(
            shoe,
            selected,
            await readObservations(id),
            key,
            saveObservations,
          ))(),
      );
    job = pending.get(id);
    const sources = await job;
    return NextResponse.json({
      sources,
      observations: await readObservations(id),
    });
  } catch {
    return NextResponse.json(
      { error: "Refresh or persistent storage unavailable." },
      { status: 503 },
    );
  } finally {
    if (pending.get(id) === job) pending.delete(id);
  }
}
