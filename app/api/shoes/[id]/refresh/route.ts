import { backendProxy } from "@/lib/backend-proxy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return backendProxy(`/shoes/${encodeURIComponent(id)}/refresh`, req);
}
