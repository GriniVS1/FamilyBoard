"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { GlassCard } from "@/components/shared/glass-card";
import { Switch } from "@/components/shared/switch";
import { cn } from "@/lib/utils";

type RelayStatus = {
  enabled: boolean;
  connected: boolean;
  since: string | null;
  remoteUrl: string | null;
};

async function fetchStatus(): Promise<RelayStatus> {
  const res = await fetch("/api/network/relay-status", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed (${res.status})`);
  return (await res.json()) as RelayStatus;
}

async function patchEnabled(enabled: boolean, adminPin: string): Promise<void> {
  const res = await fetch("/api/settings/remote-access", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Pin": adminPin },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error(`Failed (${res.status})`);
}

type RemoteAccessCardProps = { adminPin: string };

export function RemoteAccessCard({ adminPin }: RemoteAccessCardProps) {
  const t = useTranslations("settings.remoteAccess");
  const queryClient = useQueryClient();

  const { data } = useQuery<RelayStatus>({
    queryKey: ["relay-status"],
    queryFn: fetchStatus,
    // Poll while the card is visible so "connected" reflects reality quickly.
    refetchInterval: 15_000,
  });

  const mutation = useMutation({
    mutationFn: (enabled: boolean) => patchEnabled(enabled, adminPin),
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: ["relay-status"] });
      const prev = queryClient.getQueryData<RelayStatus>(["relay-status"]);
      if (prev) queryClient.setQueryData(["relay-status"], { ...prev, enabled });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["relay-status"], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["relay-status"] }),
  });

  const enabled = data?.enabled ?? true;
  const statusKey = !enabled ? "disabled" : data?.connected ? "connected" : "disconnected";
  const dotColor =
    statusKey === "connected"
      ? "bg-accent-mint"
      : statusKey === "disconnected"
        ? "bg-accent-sun"
        : "bg-muted";

  return (
    <GlassCard className="flex flex-col gap-4 p-6">
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-sky/30 text-ink"
        >
          <Globe className="size-4" />
        </span>
        <div className="flex-1 space-y-1">
          <h2 className="font-display text-xl text-ink">{t("title")}</h2>
          <p className="text-sm text-muted">{t("description")}</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => mutation.mutate(v)}
          disabled={mutation.isPending}
          aria-label={t("toggleAria")}
        />
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className={cn("size-2.5 rounded-full", dotColor)} aria-hidden />
        <span className="text-muted">{t(`status.${statusKey}`)}</span>
      </div>
    </GlassCard>
  );
}
