"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardData } from "@/lib/types";

export const REFRESH_MS = Number(process.env.NEXT_PUBLIC_REFRESH_SECONDS ?? 60) * 1000;

/** Fetches data from /api/data and refreshes it every REFRESH_MS while the tab is visible (live=false stops refreshing). */
export function useDashboardData(live = true) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [netError, setNetError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/data${force ? "?force=1" : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as DashboardData);
      setNetError(null);
    } catch (e) {
      setNetError(e instanceof Error ? e.message : "تعذر الاتصال");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => load(), 0);
    if (!live) return () => clearTimeout(first);
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, live]);

  return { data, loading, netError, reload: () => load(true) };
}
