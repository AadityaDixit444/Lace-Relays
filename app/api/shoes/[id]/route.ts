import { NextResponse } from "next/server";
import { shoes } from "@/lib/catalog";
import { readObservations, storageStatus } from "@/lib/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!shoes.some((s) => s.id === id))
    return NextResponse.json({ error: "Unknown shoe" }, { status: 404 });
  try {
    return NextResponse.json(
      { observations: await readObservations(id), storage: storageStatus() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Price history could not be loaded." },
      { status: 503 },
    );
  }
}
