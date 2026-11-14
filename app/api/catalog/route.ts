import { NextResponse } from "next/server";
import { readObservations, storageStatus } from "@/lib/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(
      { observations: await readObservations(), storage: storageStatus() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Price observations could not be loaded. Try again." },
      { status: 503 },
    );
  }
}
