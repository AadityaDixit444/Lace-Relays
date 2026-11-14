import { NextResponse } from "next/server";
// Provider credentials and persistence live in FastAPI. These routes only bridge
// the frontend's same-origin URLs; they never fall back to a second backend.
export async function backendProxy(path: string, req?: Request) {
  const configured = process.env.LACERELAY_API_URL;
  if (!configured)
    return NextResponse.json(
      { error: "The FastAPI backend is not connected." },
      { status: 503 },
    );
  let url: URL;
  const bypass = process.env.LACERELAY_BACKEND_BYPASS_SECRET;
  let useBypass = false;
  try {
    url = new URL(configured);
    if (url.username || url.password || url.search || url.hash)
      throw new Error();
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    useBypass = Boolean(bypass && url.hostname.endsWith(".vercel.app"));
    if (bypass && !local && !useBypass) throw new Error();
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        local &&
        process.env.NODE_ENV !== "production"
      )
    )
      throw new Error();
  } catch {
    return NextResponse.json(
      { error: "Invalid backend configuration." },
      { status: 503 },
    );
  }
  let body: string | undefined;
  if (req?.method === "POST") {
    const reader = req.body?.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 2048) {
          await reader.cancel();
          return NextResponse.json(
            { error: "Request too large." },
            { status: 413 },
          );
        }
        chunks.push(chunk.value);
      }
    }
    body = Buffer.concat(chunks).toString("utf8");
  }
  try {
    const response = await fetch(`${url.href.replace(/\/$/, "")}${path}`, {
      method: req?.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(useBypass ? { "x-vercel-protection-bypass": bypass! } : {}),
        ...(req?.headers.get("authorization")
          ? { Authorization: req.headers.get("authorization")! }
          : {}),
      },
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(25000),
    });
    const data = await response.json();
    return NextResponse.json(data, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "FastAPI is unavailable. Please try again." },
      { status: 502 },
    );
  }
}
