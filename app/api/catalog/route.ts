import { backendProxy } from "@/lib/backend-proxy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return backendProxy("/catalog");
}
