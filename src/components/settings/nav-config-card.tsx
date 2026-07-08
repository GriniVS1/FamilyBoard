"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, LayoutGrid } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { GlassCard } from "@/components/shared/glass-card";
import { NAV_ICON } from "@/components/shared/nav-icons";
import { Switch } from "@/components/shared/switch";
import { cn } from "@/lib/utils";
import type { NavConfigItem, NavKey } from "@/lib/nav-config";
import { NAV_CONFIG_QUERY_KEY, fetchNavConfig } from "@/components/shell/use-nav-config";

async function patchNavConfig(
  items: NavConfigItem[],
  adminPin: string,
): Promise<NavConfigItem[]> {
  const res = await fetch("/api/settings/nav", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Pin": adminPin },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      if (data?.error?.message) message = data.error.message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  const data = (await res.json()) as { items: NavConfigItem[] };
  return data.items;
}

type NavConfigCardProps = {
  adminPin: string;
};

export function NavConfigCard({ adminPin }: NavConfigCardProps) {
  const t = useTranslations("settings.navConfig");
  const tNav = useTranslations("nav");
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data = [] } = useQuery({
    queryKey: NAV_CONFIG_QUERY_KEY,
    queryFn: fetchNavConfig,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (items: NavConfigItem[]) => patchNavConfig(items, adminPin),
    onMutate: async (items) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: NAV_CONFIG_QUERY_KEY });
      const previous = queryClient.getQueryData<NavConfigItem[]>(NAV_CONFIG_QUERY_KEY);
      queryClient.setQueryData(NAV_CONFIG_QUERY_KEY, items);
      return { previous };
    },
    onError: (_err, _items, context) => {
      if (context?.previous) {
        queryClient.setQueryData(NAV_CONFIG_QUERY_KEY, context.previous);
      }
      setError(t("saveError"));
    },
    onSuccess: (items) => {
      queryClient.setQueryData(NAV_CONFIG_QUERY_KEY, items);
      void queryClient.invalidateQueries({ queryKey: NAV_CONFIG_QUERY_KEY });
    },
  });

  function toggle(key: NavKey, enabled: boolean) {
    mutation.mutate(data.map((item) => (item.key === key ? { ...item, enabled } : item)));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= data.length) return;
    const next = [...data];
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    mutation.mutate(next);
  }

  return (
    <GlassCard className="flex flex-col gap-4 p-6">
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-teal/30 text-ink"
        >
          <LayoutGrid className="size-4" />
        </span>
        <div className="flex-1 space-y-1">
          <h2 className="font-display text-xl text-ink">{t("title")}</h2>
          <p className="text-sm text-muted">{t("description")}</p>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {data.map((item, index) => {
          const Icon = NAV_ICON[item.key];
          const name = tNav(item.key as Parameters<typeof tNav>[0]);
          return (
            <li
              key={item.key}
              className={cn(
                "flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition-opacity",
                !item.enabled && "opacity-60",
              )}
            >
              <span
                aria-hidden
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-sky/30 text-ink"
              >
                <Icon className="size-4" />
              </span>
              <span className="flex-1 truncate text-sm font-medium text-ink">{name}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0 || mutation.isPending}
                  aria-label={t("moveUp", { name })}
                  className="tap-target inline-flex items-center justify-center rounded-xl text-ink transition-colors hover:bg-bg disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === data.length - 1 || mutation.isPending}
                  aria-label={t("moveDown", { name })}
                  className="tap-target inline-flex items-center justify-center rounded-xl text-ink transition-colors hover:bg-bg disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronDown className="size-4" />
                </button>
              </div>
              <Switch
                checked={item.enabled}
                onCheckedChange={(enabled) => toggle(item.key, enabled)}
                disabled={mutation.isPending}
                aria-label={t("toggleAria", { name })}
              />
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-muted">{t("alwaysVisibleHint")}</p>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="text-xs text-accent-rose"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
