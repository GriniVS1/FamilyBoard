"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, RefreshCw, Terminal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";

type UpdateStatus = { version: string; channel: string };
type UpdateLog = { log: string; available: boolean };

type UpdatesSettingsCardProps = {
  adminPin: string;
};

export function UpdatesSettingsCard({ adminPin }: UpdatesSettingsCardProps) {
  const t = useTranslations("settings.updates");
  const [notice, setNotice] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);

  const { data } = useQuery<UpdateStatus>({
    queryKey: ["update-status"],
    queryFn: async () => {
      const res = await fetch("/api/settings/update-status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as UpdateStatus;
    },
  });

  // Only fetched while the log panel is open; refetches every few seconds so an
  // in-progress update streams into view.
  const { data: logData, isFetching: logFetching, refetch: refetchLog } =
    useQuery<UpdateLog>({
      queryKey: ["update-log"],
      queryFn: async () => {
        const res = await fetch("/api/settings/update-log");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as UpdateLog;
      },
      enabled: showLog,
      refetchInterval: showLog ? 4000 : false,
    });

  const checkMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/settings/update-status", {
        method: "POST",
        headers: { "X-Admin-Pin": adminPin },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
    onSuccess: () => {
      setNotice(t("requested"));
      // Show the log automatically so the user can watch the run they just triggered.
      setShowLog(true);
    },
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

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setNotice(null);
            checkMutation.mutate();
          }}
          disabled={checkMutation.isPending}
        >
          <RefreshCw className="size-4" />
          {checkMutation.isPending ? t("checking") : t("checkNow")}
        </Button>

        <button
          type="button"
          onClick={() => setShowLog((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink tap-target"
          aria-expanded={showLog}
        >
          <Terminal className="size-4" />
          {showLog ? t("hideLog") : t("showLog")}
          <ChevronDown
            className={cn("size-4 transition-transform", showLog && "rotate-180")}
          />
        </button>
      </div>

      {notice && <p className="text-sm text-muted">{notice}</p>}

      {showLog && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t("logTitle")}
            </span>
            <button
              type="button"
              onClick={() => void refetchLog()}
              className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-ink"
            >
              <RefreshCw className={cn("size-3", logFetching && "animate-spin")} />
              {t("logRefresh")}
            </button>
          </div>
          <pre className="max-h-72 overflow-auto rounded-2xl border border-border bg-ink/90 p-4 text-xs leading-relaxed text-bg">
            {logData?.log
              ? logData.log
              : logData && !logData.available
                ? t("logUnavailable")
                : t("logEmpty")}
          </pre>
        </div>
      )}
    </GlassCard>
  );
}
