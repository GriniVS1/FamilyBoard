"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Globe, Loader2, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { Switch } from "@/components/shared/switch";
import { cn } from "@/lib/utils";
import type { CalendarMember } from "@/components/calendar/types";

type RelayStatus = {
  enabled: boolean;
  connected: boolean;
  since: string | null;
  remoteUrl: string | null;
};

type PairCodeResponse = {
  code: string;
  expiresAt: string;
  serverUrl: string | null;
  mdnsUrl: string | null;
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

type RemoteAccessCardProps = { adminPin: string; members: CalendarMember[] };

export function RemoteAccessCard({ adminPin, members }: RemoteAccessCardProps) {
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

      {enabled && statusKey === "connected" && (
        <WebAccessSection adminPin={adminPin} members={members} />
      )}
    </GlassCard>
  );
}

type WebStage = "idle" | "pick" | "code";

type WebAccessSectionProps = { adminPin: string; members: CalendarMember[] };

function WebAccessSection({ adminPin, members }: WebAccessSectionProps) {
  const t = useTranslations("settings.remoteAccess.web");
  const tCommon = useTranslations("common");

  const [stage, setStage] = useState<WebStage>("idle");
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    members[0]?.id ?? "",
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pairLink, setPairLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!expiresAt) return;

    function tick() {
      if (!expiresAt) return;
      const diff = Math.max(
        0,
        Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(diff);
    }

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [expiresAt]);

  function openPicker() {
    setSelectedMemberId(members[0]?.id ?? "");
    setError(null);
    setStage("pick");
  }

  function reset() {
    setStage("idle");
    setPairLink(null);
    setExpiresAt(null);
    setSecondsLeft(0);
    setError(null);
    setCopied(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  async function handleGenerate() {
    if (!selectedMemberId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/pair-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: selectedMemberId, pin: adminPin }),
      });
      if (!res.ok) {
        setError(t("error"));
        return;
      }
      const data = (await res.json()) as PairCodeResponse;
      if (!data.remoteUrl) {
        setError(t("unavailable"));
        return;
      }
      // remoteUrl is "<https-origin>/f/<installationId>" (src/lib/relay-url.ts).
      // The SPA lives at "<https-origin>/app" on the same worker.
      const url = new URL(data.remoteUrl);
      const installationId = url.pathname.replace(/^\/f\//, "");
      const link = `${url.origin}/app#pair=${installationId}.${data.code}`;
      setPairLink(link);
      setExpiresAt(new Date(data.expiresAt));
      setStage("code");
    } catch {
      setError(t("error"));
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!pairLink) return;
    try {
      await navigator.clipboard.writeText(pairLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silent fail
    }
  }

  const isExpired = secondsLeft === 0 && stage === "code";

  return (
    <div className="rounded-2xl border border-border bg-bg/60 p-4">
      <AnimatePresence mode="wait" initial={false}>
        {stage === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                aria-hidden
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-lilac/30 text-ink"
              >
                <QrCode className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{t("title")}</p>
                <p className="text-xs text-muted">{t("description")}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={openPicker}
              disabled={members.length === 0}
              className="shrink-0"
            >
              {t("setup")}
            </Button>
          </motion.div>
        )}

        {stage === "pick" && (
          <motion.div
            key="pick"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t("member")}
            </p>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMemberId(m.id)}
                  aria-pressed={selectedMemberId === m.id}
                  className={cn(
                    "flex min-h-12 items-center gap-2 rounded-2xl border px-3 py-2 text-left transition-colors tap-target",
                    selectedMemberId === m.id
                      ? "border-ink bg-ink/5"
                      : "border-border bg-surface hover:bg-bg",
                  )}
                >
                  <MemberAvatar
                    name={m.name}
                    color={m.color}
                    emoji={m.emoji}
                    className="size-7 shrink-0"
                  />
                  <span className="text-sm font-medium text-ink">
                    {m.name}
                  </span>
                  {selectedMemberId === m.id && (
                    <Check className="size-4 shrink-0 text-ink" />
                  )}
                </button>
              ))}
            </div>

            {error && (
              <p role="alert" className="text-sm text-accent-rose">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={reset}
                disabled={generating}
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleGenerate}
                disabled={generating || !selectedMemberId}
              >
                {generating && <Loader2 className="size-4 animate-spin" />}
                {generating ? t("generating") : t("generateCode")}
              </Button>
            </div>
          </motion.div>
        )}

        {stage === "code" && (
          <motion.div
            key="code"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-4"
          >
            {isExpired ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <p className="text-sm font-medium text-accent-rose">
                  {t("expired")}
                </p>
                <Button type="button" variant="primary" onClick={openPicker}>
                  {t("generateNew")}
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted">{t("scanOrOpen")}</p>
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                  <div className="rounded-2xl border border-border bg-surface p-3">
                    {pairLink && (
                      <QRCodeSVG
                        value={pairLink}
                        size={144}
                        bgColor="transparent"
                        fgColor="currentColor"
                        className="text-ink"
                        level="M"
                      />
                    )}
                  </div>

                  <div className="flex-1 space-y-2 w-full">
                    <label
                      htmlFor="web-access-link"
                      className="text-xs font-semibold uppercase tracking-wider text-muted"
                    >
                      {t("linkLabel")}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="web-access-link"
                        type="text"
                        readOnly
                        value={pairLink ?? ""}
                        onFocus={(e) => e.currentTarget.select()}
                        className="min-h-12 flex-1 truncate rounded-xl border border-border bg-surface px-3 text-sm text-ink"
                      />
                      <button
                        type="button"
                        onClick={handleCopy}
                        aria-label={t("copyLink")}
                        className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors hover:bg-bg hover:text-ink tap-target"
                      >
                        {copied ? (
                          <Check className="size-4 text-accent-mint" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                      </button>
                    </div>
                    {copied && (
                      <p role="status" className="text-xs text-accent-mint">
                        {t("copied")}
                      </p>
                    )}
                    <p className="text-xs tabular-nums text-muted">
                      {t("expiresIn", { seconds: secondsLeft })}
                    </p>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-1">
              {!isExpired && (
                <Button type="button" variant="ghost" onClick={openPicker}>
                  {t("generateNew")}
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={reset}>
                {tCommon("close")}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
