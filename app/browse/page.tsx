import Browse from "@/components/browse";
import { parseFilters } from "@/lib/browse-state";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(raw))
    if (typeof v === "string") p.set(k, v);
  return <Browse initial={parseFilters(p)} />;
}
