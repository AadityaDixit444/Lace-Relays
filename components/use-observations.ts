"use client";
import { useEffect, useState, useCallback } from "react";
import type { Observation } from "@/lib/observations";
export function useObservations(id?: string) {
  const [rows, setRows] = useState<Observation[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [now, setNow] = useState(0);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await fetch(
          id ? `/api/shoes/${encodeURIComponent(id)}` : "/api/catalog",
          { cache: "no-store", signal },
        );
        if (!res.ok)
          throw new Error(
            "Price observations could not be loaded. Please retry.",
          );
        const data = await res.json();
        setRows(data.observations);
        setError("");
        setNow(Date.now());
      } catch (e) {
        if (signal?.aborted) return;
        setError(e instanceof Error ? e.message : "Could not load prices");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [id],
  );
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [load]);
  return { rows, loading, error, now, reload: () => load() };
}
