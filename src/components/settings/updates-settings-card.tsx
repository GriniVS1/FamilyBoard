"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, RefreshCw, Terminal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";

type UpdateProgressPhase =
  | "checking"
  | "downloading"
  | "verifying"
  | "installing"
  | "health"
  | "done"
  | "failed"
  | "rolledback"
  | "uptodate";

type UpdateProgress = {
  phase: UpdateProgressPhase;
  version?: string;
  percent?: number;
  updatedAt: string;
};

type UpdateStatus = {
  version: string;
  channel: string;
  justUpdated: boolean;
  progress: UpdateProgress | null;
};

type UpdateLog = { log: string; available: boolean };

type UpdatesSettingsCardProps = {
  adminPin: string;
};

const ACTIVE_PHASES = new Set<UpdateProgressPhase>([
  "checking",
  "downloading",
  "verifying",
  "installing",
  "health",
]);

// How close to the bottom (px) counts as "already at the end" — the user
// hasn't scrolled up to read history, so new log lines should keep following.
const AUTO_SCROLL_TOLERANCE = 40;

export function UpdatesSettingsCard({ adminPin }: UpdatesSettingsCardProps) {
  const t = useTranslations("settings.updates");
  const [notice, setNotice] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef<HTMLPreElement>(null);

  const { data } = useQuery<UpdateStatus>({
    queryKey: ["update-status"],
    queryFn: async () => {
      const res = await fetch("/api/settings/update-status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as UpdateStatus;
    },
    refetchInterval: (query) => {
      const phase = query.state.data?.progress?.phase;
      return phase && ACTIVE_PHASES.has(phase) ? 2500 : 30000;
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

  useEffect(() => {
    if (showLog) setAutoScroll(true);
  }, [showLog]);

  useEffect(() => {
    if (!showLog || !autoScroll) return;
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [showLog, autoScroll, logData?.log]);

  function handleLogScroll() {
    const el = logRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAutoScroll(distanceFromBottom < AUTO_SCROLL_TOLERANCE);
  }

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

  const progress = data?.progress ?? null;
  const isActive = progress !== null && ACTIVE_PHASES.has(progress.phase);
  const isFailed = progress?.phase === "failed" || progress?.phase === "rolledback";
  const isSettled = progress?.phase === "done" || progress?.phase === "uptodate";

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

      <AnimatePresence initial={false}>
        {isActive && progress && (
          <motion.div
            key="progress"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 rounded-2xl border border-border bg-bg/40 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">
                  {t(`progress.${progress.phase}` as Parameters<typeof t>[0])}
                </span>
                {typeof progress.percent === "number" && (
                  <span className="font-mono text-xs tabular-nums text-muted">
                    {Math.round(progress.percent)}%
                  </span>
                )}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-border/60">
                {typeof progress.percent === "number" ? (
                  <motion.div
                    className="h-full rounded-full bg-accent-mint"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(100, Math.max(0, progress.percent))}%`,
                    }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  />
                ) : (
                  <motion.div
                    className="h-full w-1/3 rounded-full bg-accent-mint"
                    animate={{ x: ["-100%", "300%"] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
              </div>
              {progress.version && (
                <p className="text-xs text-muted">
                  {t("progress.targetVersion", { version: progress.version })}
                </p>
              )}
            </div>
          </motion.div>
        )}

        {isFailed && progress && (
          <motion.p
            key="progress-failed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="text-sm text-accent-rose"
          >
            {t(`progress.${progress.phase}` as Parameters<typeof t>[0])}
          </motion.p>
        )}

        {isSettled && progress && (
          <motion.p
            key="progress-settled"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="text-sm text-accent-mint"
          >
            {t(`progress.${progress.phase}` as Parameters<typeof t>[0])}
          </motion.p>
        )}
      </AnimatePresence>

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
          <pre
            ref={logRef}
            onScroll={handleLogScroll}
            className="max-h-72 overflow-auto rounded-2xl border border-border bg-ink/90 p-4 text-xs leading-relaxed text-bg"
          >
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
