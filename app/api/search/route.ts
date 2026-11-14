import { backendProxy } from "@/lib/backend-proxy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  return backendProxy("/search", req);
}
