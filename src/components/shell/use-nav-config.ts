"use client";

import { useQuery } from "@tanstack/react-query";
import type { NavConfigItem } from "@/lib/nav-config";

export const NAV_CONFIG_QUERY_KEY = ["nav-config"] as const;

export async function fetchNavConfig(): Promise<NavConfigItem[]> {
  const res = await fetch("/api/settings/nav", { cache: "no-store" });
  if (!res.ok) throw new Error(`Nav config fetch failed (${res.status})`);
  const data = (await res.json()) as { items: NavConfigItem[] };
  return data.items;
}

// Generous staleTime: the nav rarely changes and the shell/settings card both
// read this key, so a settings PATCH explicitly invalidates it rather than
// relying on refetch timing.
export function useNavConfig() {
  return useQuery({
    queryKey: NAV_CONFIG_QUERY_KEY,
    queryFn: fetchNavConfig,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
