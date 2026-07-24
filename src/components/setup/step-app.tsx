"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { AlertCircle, Apple, CheckCircle2, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";

type ConnectInfo = {
  installationId: string;
  serverUrl: string | null;
  mdnsUrl: string | null;
  appDownload: {
    ios: string;
    android: string;
  };
};

type SetupStatusResponse = {
  familyCreated: boolean;
  memberCount: number;
  pinSet: boolean;
};

type StepAppProps = {
  onFallback: () => void;
  onComplete: () => void;
};

const POLL_INTERVAL_MS = 3000;

export function StepApp({ onFallback, onComplete }: StepAppProps) {
  const t = useTranslations("setup.app");

  const [info, setInfo] = useState<ConnectInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [appStarted, setAppStarted] = useState(false);

  async function loadConnectInfo() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch("/api/setup/connect-info");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ConnectInfo;
      setInfo(data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConnectInfo();
  }, []);

  // The phone app finishes the classic wizard steps (family, members, pin) on
  // its own; we just poll the same status shape the wall wizard already uses
  // and auto-advance once it reports done. Weather stays optional and is left
  // for later, same as the on-wall flow.
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/setup/status");
        if (!res.ok) return;
        const data = (await res.json()) as SetupStatusResponse;
        if (data.familyCreated && data.memberCount >= 1) {
          setAppStarted(true);
        }
        if (data.familyCreated && data.memberCount >= 1 && data.pinSet) {
          clearInterval(interval);
          onComplete();
        }
      } catch {
        // keep polling — a transient blip shouldn't interrupt the wait
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const qrOrigin =
    info?.serverUrl ??
    (typeof window !== "undefined" ? window.location.origin : null);
  const qrAlt = info?.mdnsUrl && info.mdnsUrl !== qrOrigin ? info.mdnsUrl : null;
  const connectValue =
    info && qrOrigin
      ? `familyboard://setup?url=${encodeURIComponent(qrOrigin)}${
          qrAlt ? `&alt=${encodeURIComponent(qrAlt)}` : ""
        }&installation=${info.installationId}`
      : "";

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-accent-lilac/30">
            <Smartphone className="size-5 text-ink" />
          </span>
          <p className="text-muted text-sm font-medium tracking-wide uppercase">
            {t("title")}
          </p>
        </div>
        <h2 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05]">
          {t("title")}
        </h2>
        <p className="text-muted text-lg max-w-xl">{t("subtitle")}</p>
      </div>

      {loading && (
        <div className="flex flex-col items-center gap-4 py-16">
          <Loader2 className="size-10 text-muted animate-spin" />
        </div>
      )}

      {!loading && loadError && (
        <GlassCard className="p-6 flex flex-col items-center gap-4 text-center">
          <AlertCircle className="size-8 text-accent-rose" strokeWidth={2} />
          <p className="text-ink">{t("loadFailed")}</p>
          <Button onClick={() => void loadConnectInfo()}>{t("retry")}</Button>
        </GlassCard>
      )}

      {!loading && !loadError && info && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="flex flex-col gap-6"
        >
          <p className="text-muted text-xs font-medium uppercase tracking-wide">
            {t("downloadTitle")}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <GlassCard className="p-5 flex flex-col items-center gap-3 text-center">
              <div className="flex items-center gap-2 text-muted text-sm font-medium uppercase tracking-wide">
                <Apple className="size-4" />
                {t("iosLabel")}
              </div>
              <div className="rounded-2xl border border-border bg-surface p-3">
                <QRCodeSVG
                  value={info.appDownload.ios}
                  size={128}
                  bgColor="transparent"
                  fgColor="currentColor"
                  className="text-ink"
                  level="M"
                />
              </div>
            </GlassCard>

            <GlassCard className="p-5 flex flex-col items-center gap-3 text-center">
              <div className="flex items-center gap-2 text-muted text-sm font-medium uppercase tracking-wide">
                <Smartphone className="size-4" />
                {t("androidLabel")}
              </div>
              <div className="rounded-2xl border border-border bg-surface p-3">
                <QRCodeSVG
                  value={info.appDownload.android}
                  size={128}
                  bgColor="transparent"
                  fgColor="currentColor"
                  className="text-ink"
                  level="M"
                />
              </div>
            </GlassCard>
          </div>

          <GlassCard className="p-6 flex flex-col items-center gap-4 text-center bg-accent-mint/10 border-accent-mint/40">
            <h3 className="font-display text-xl">{t("connectTitle")}</h3>
            <p className="text-muted text-sm max-w-sm">{t("connectHint")}</p>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <QRCodeSVG
                value={connectValue}
                size={200}
                bgColor="transparent"
                fgColor="currentColor"
                className="text-ink"
                level="M"
              />
            </div>

            <div className="flex items-center gap-2 text-sm text-muted" role="status">
              {appStarted ? (
                <CheckCircle2 className="size-4 text-accent-mint" />
              ) : (
                <motion.span
                  className="size-2 rounded-full bg-accent-sky"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              <span>{t("waitingForApp")}</span>
            </div>
          </GlassCard>

          <div className="flex justify-center">
            <Button
              type="button"
              variant="ghost"
              onClick={onFallback}
              className="text-muted"
            >
              {t("fallbackLink")}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
