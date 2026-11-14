import { notFound } from "next/navigation";
import { shoes } from "@/lib/catalog";
import { parseFilters } from "@/lib/browse-state";
import ShoeDetail from "@/components/shoe-detail";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const shoe = shoes.find((s) => s.id === id);
  if (!shoe) notFound();
  const raw = await searchParams;
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(raw))
    if (typeof v === "string") query.set(k, v);
  return <ShoeDetail shoe={shoe} filters={parseFilters(query)} />;
}
