"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, LayoutGrid } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { GlassCard } from "@/components/shared/glass-card";
import { Picto } from "@/components/pictos";
import { NAV_PICTO } from "@/components/shared/nav-icons";
import { Switch } from "@/components/shared/switch";
import { cn } from "@/lib/utils";
import type { NavConfigItem, NavKey } from "@/lib/nav-config";
import { NAV_CONFIG_QUERY_KEY, fetchNavConfig } from "@/components/shell/use-nav-config";
import {
  PINNED_NAV_KEY,
  flattenNavOrder,
  resolveNavOrder,
  type NavGroupItem,
  type NavOrder,
} from "@/components/shell/nav-order";

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

type GroupId = keyof NavOrder;

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

  const order = resolveNavOrder(data);

  function persist(next: NavOrder) {
    mutation.mutate(flattenNavOrder(next));
  }

  function toggle(key: NavKey, enabled: boolean) {
    const apply = (items: NavGroupItem[]) =>
      items.map((item) => (item.key === key ? { ...item, enabled } : item));
    persist({ kids: apply(order.kids), adults: apply(order.adults) });
  }

  function move(group: GroupId, index: number, direction: -1 | 1) {
    const items = [...order[group]];
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    if (items[index]!.key === PINNED_NAV_KEY || items[target]!.key === PINNED_NAV_KEY) return;
    [items[index], items[target]] = [items[target]!, items[index]!];
    persist({ ...order, [group]: items });
  }

  const groups: { id: GroupId; title: string }[] = [
    { id: "kids", title: t("groupKids") },
    { id: "adults", title: t("groupAdults") },
  ];

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

      {groups.map(({ id, title }) => (
        <section key={id} aria-label={title} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{title}</h3>
          <ul className="flex flex-col gap-2">
            {order[id].map((item, index, list) => {
              const name = tNav(item.key as Parameters<typeof tNav>[0]);
              const pinned = item.key === PINNED_NAV_KEY;
              return (
                <li
                  key={item.key}
                  className={cn(
                    "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-border bg-surface p-3 transition-opacity",
                    !item.enabled && "opacity-60",
                  )}
                >
                  <Picto name={NAV_PICTO[item.key]} size={40} />
                  <span className="kid-body min-w-[7rem] flex-1 text-ink">{name}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(id, index, -1)}
                      disabled={index === 0 || pinned || list[index - 1]?.key === PINNED_NAV_KEY || mutation.isPending}
                      aria-label={t("moveUp", { name })}
                      className="tap-target inline-flex items-center justify-center rounded-xl text-ink transition-colors hover:bg-ink/5 focus-ring-kid disabled:pointer-events-none disabled:opacity-30"
                    >
                      <ChevronUp className="size-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(id, index, 1)}
                      disabled={index === list.length - 1 || pinned || mutation.isPending}
                      aria-label={t("moveDown", { name })}
                      className="tap-target inline-flex items-center justify-center rounded-xl text-ink transition-colors hover:bg-ink/5 focus-ring-kid disabled:pointer-events-none disabled:opacity-30"
                    >
                      <ChevronDown className="size-5" />
                    </button>
                    <Switch
                      checked={item.enabled}
                      onCheckedChange={(enabled) => toggle(item.key, enabled)}
                      disabled={mutation.isPending}
                      aria-label={t("toggleAria", { name })}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <p className="text-sm text-muted">{t("alwaysVisibleHint")}</p>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="text-xs text-danger-ink"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
