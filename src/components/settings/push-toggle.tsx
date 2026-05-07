"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";
import { subscribeToPush, unsubscribeFromPush, getCurrentSubscription } from "@/lib/push";

type PermissionState = "granted" | "denied" | "default" | "unsupported";

type TestResult = { sent: number; failed: number } | null;

function permissionPillClass(state: PermissionState): string {
  if (state === "granted") return "bg-accent-mint/30 text-ink";
  if (state === "denied") return "bg-surface text-muted border border-border";
  return "bg-accent-sun/20 text-ink";
}

export function PushToggle() {
  const t = useTranslations("settings.push");

  const [permission, setPermission] = useState<PermissionState>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PermissionState);
    getCurrentSubscription().then((sub) => {
      setSubscribed(!!sub);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!testResult) return;
    const timer = window.setTimeout(() => setTestResult(null), 3000);
    return () => window.clearTimeout(timer);
  }, [testResult]);

  async function handleEnable() {
    setEnabling(true);
    setError(null);
    try {
      const sub = await subscribeToPush();
      const json = sub.toJSON() as {
        endpoint: string;
        keys?: { p256dh?: string; auth?: string };
      };
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: {
            p256dh: json.keys?.p256dh ?? "",
            auth: json.keys?.auth ?? "",
          },
          deviceLabel: navigator.userAgent.slice(0, 80),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPermission(Notification.permission as PermissionState);
      setSubscribed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setPermission(Notification.permission as PermissionState);
    } finally {
      setEnabling(false);
    }
  }

  async function handleDisable() {
    setError(null);
    try {
      await unsubscribeFromPush();
      setSubscribed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleTest() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { sent: number; failed: number };
      setTestResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <GlassCard className="flex flex-col gap-4 p-6">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-sky/30 text-ink"
        >
          <Bell className="size-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl text-ink">{t("title")}</h2>
            {permission !== "unsupported" && (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${permissionPillClass(permission)}`}
              >
                {permission === "granted"
                  ? t("permission.granted")
                  : permission === "denied"
                  ? t("permission.denied")
                  : t("permission.default")}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">{t("description")}</p>
        </div>
      </div>

      {permission === "unsupported" && (
        <div className="flex items-start gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{t("denyHelp")}</span>
        </div>
      )}

      {permission === "denied" && (
        <div className="flex items-start gap-2 rounded-2xl border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-ink">
          <BellOff className="mt-0.5 size-4 shrink-0 text-accent-rose" />
          <span>{t("denyHelp")}</span>
        </div>
      )}

      {permission !== "denied" && permission !== "unsupported" && (
        <div className="flex flex-wrap items-center gap-3">
          {!subscribed ? (
            <Button
              variant="primary"
              onClick={() => void handleEnable()}
              disabled={enabling}
              className="min-h-12"
            >
              <BellRing className="size-4" />
              {enabling ? t("enabling") : t("enable")}
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => void handleDisable()}
                className="min-h-12"
              >
                <BellOff className="size-4" />
                {t("disable")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => void handleTest()}
                disabled={sending}
                className="min-h-12"
              >
                <Bell className="size-4" />
                {sending ? t("sending") : t("sendTest")}
              </Button>
            </>
          )}
        </div>
      )}

      {testResult && (
        <div className="rounded-2xl border border-accent-mint/40 bg-accent-mint/15 px-4 py-2.5 text-sm text-ink">
          {t("testSent", { sent: testResult.sent, failed: testResult.failed })}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-accent-rose/30 bg-accent-rose/10 px-4 py-2.5 text-sm text-accent-rose">
          {error}
        </div>
      )}
    </GlassCard>
  );
}
