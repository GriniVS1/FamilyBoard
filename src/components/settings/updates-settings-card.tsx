"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";

type UpdateStatus = { version: string; channel: string };

type UpdatesSettingsCardProps = {
  adminPin: string;
};

export function UpdatesSettingsCard({ adminPin }: UpdatesSettingsCardProps) {
  const t = useTranslations("settings.updates");
  const [notice, setNotice] = useState<string | null>(null);

  const { data } = useQuery<UpdateStatus>({
    queryKey: ["update-status"],
    queryFn: async () => {
      const res = await fetch("/api/settings/update-status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as UpdateStatus;
    },
  });

  const checkMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/settings/update-status", {
        method: "POST",
        headers: { "X-Admin-Pin": adminPin },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
    onSuccess: () => setNotice(t("requested")),
    onError: () => setNotice(t("checkFailed")),
  });

  return (
    <GlassCard className="flex flex-col gap-4 p-6">
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-mint/30 text-ink"
        >
          <RefreshCw className="size-4" />
        </span>
        <div className="flex-1 space-y-1">
          <h2 className="font-display text-xl text-ink">{t("title")}</h2>
          <p className="text-sm text-muted">{t("description")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-bg/40 px-4 py-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
            {t("currentVersion")}
          </div>
          <div className="font-mono text-sm font-medium text-ink">
            {data?.version ?? "…"}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-bg/40 px-4 py-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
            {t("channel")}
          </div>
          <div className="text-sm font-medium text-ink">{data?.channel ?? "…"}</div>
        </div>
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setNotice(null);
          checkMutation.mutate();
        }}
        disabled={checkMutation.isPending}
        className="self-start"
      >
        <RefreshCw className="size-4" />
        {checkMutation.isPending ? t("checking") : t("checkNow")}
      </Button>

      {notice && <p className="text-sm text-muted">{notice}</p>}
    </GlassCard>
  );
}
