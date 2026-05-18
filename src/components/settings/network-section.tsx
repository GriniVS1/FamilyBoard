"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, RefreshCw, Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";
import { StepNetwork } from "@/components/setup/step-network";
import { cn } from "@/lib/utils";

type NetworkStatus = {
  connected: boolean;
  online: boolean;
  ssid?: string;
  ipAddress?: string;
  hotspotActive: boolean;
};

type NetworkSectionProps = {
  adminPin: string;
  unlocked: boolean;
};

async function networkPost<T>(url: string, adminPin: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Admin-Pin": adminPin,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      if (data?.error?.message) message = data.error.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export function NetworkSection({ adminPin, unlocked }: NetworkSectionProps) {
  const t = useTranslations("settings.network");
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [showChangeWifi, setShowChangeWifi] = useState(false);
  const [forgetting, setForgetting] = useState(false);
  const [forgetConfirm, setForgetConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/network/status", {
        headers: { "X-Admin-Pin": adminPin },
      });
      if (!res.ok) throw new Error("status failed");
      const data = (await res.json()) as NetworkStatus;
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => {
    if (unlocked) {
      void loadStatus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  async function handleForget() {
    if (!forgetConfirm) {
      setForgetConfirm(true);
      return;
    }
    setForgetting(true);
    setError(null);
    try {
      await networkPost("/api/network/wifi-disconnect", adminPin);
      setForgetConfirm(false);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setForgetting(false);
    }
  }

  return (
    <GlassCard className="flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-display text-xl text-ink">{t("title")}</h2>
          <p className="text-sm text-muted">
            {loadingStatus ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" />
                Loading…
              </span>
            ) : status?.connected && status.ssid ? (
              t("currentSsid", { ssid: status.ssid })
            ) : (
              t("notConnected")
            )}
          </p>
        </div>
        <div
          className={cn(
            "inline-flex size-10 items-center justify-center rounded-full shrink-0",
            status?.connected ? "bg-accent-mint/30" : "bg-border",
          )}
        >
          {status?.connected ? (
            <Wifi className="size-5 text-ink" />
          ) : (
            <WifiOff className="size-5 text-muted" />
          )}
        </div>
      </div>

      {status?.ipAddress && (
        <p className="text-xs text-muted font-mono">{status.ipAddress}</p>
      )}

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="text-sm text-accent-rose"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setShowChangeWifi((v) => !v);
            setForgetConfirm(false);
          }}
          disabled={!unlocked}
        >
          <RefreshCw className="size-4" />
          {t("changeWifi")}
        </Button>

        {status?.connected && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => void handleForget()}
            disabled={!unlocked || forgetting}
            className={forgetConfirm ? "text-accent-rose hover:bg-accent-rose/20" : "text-muted"}
          >
            {forgetting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            {forgetConfirm
              ? t("forgetConfirm", { ssid: status.ssid ?? "" })
              : t("forgetWifi")}
          </Button>
        )}
      </div>

      <AnimatePresence>
        {showChangeWifi && (
          <motion.div
            key="change-wifi"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            className="overflow-hidden"
          >
            <div className="pt-4 border-t border-border">
              <StepNetwork
                onComplete={async () => {
                  setShowChangeWifi(false);
                  await loadStatus();
                }}
                onSkip={() => setShowChangeWifi(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
