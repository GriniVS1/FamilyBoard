"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";

type UpdateStatus = {
  version: string;
  justUpdated: boolean;
};

const POLL_INTERVAL_MS = 60_000;
const AUTO_DISMISS_MS = 10_000;

// Mounted once in AppShell so it surfaces on whichever screen the wall
// happens to be showing after an overnight OTA update, not just Settings.
export function UpdateSuccessToast() {
  const t = useTranslations("dashboard.updateSuccess");
  const [dismissed, setDismissed] = useState(false);
  const ackFiredRef = useRef(false);

  const { data } = useQuery<UpdateStatus>({
    queryKey: ["update-status-toast"],
    queryFn: async () => {
      const res = await fetch("/api/settings/update-status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as UpdateStatus;
    },
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: false,
  });

  const ackMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/settings/update-ack", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
  });

  const visible = Boolean(data?.justUpdated) && !dismissed;

  function dismiss() {
    setDismissed(true);
    if (ackFiredRef.current) return;
    ackFiredRef.current = true;
    ackMutation.mutate();
  }

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-4 z-[90] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2"
        >
          <GlassCard className="flex items-start gap-3 border-accent-mint/40 p-4 shadow-lift">
            <span
              aria-hidden
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-mint/30 text-ink"
            >
              <CheckCircle2 className="size-5" />
            </span>
            <div className="flex-1 space-y-1 pt-1">
              <p className="text-sm font-medium text-ink">{t("title")}</p>
              {data?.version && (
                <p className="font-mono text-xs text-muted">
                  {t("version", { version: data.version })}
                </p>
              )}
            </div>
            <Button type="button" variant="secondary" onClick={dismiss} className="h-12 px-5 text-sm">
              {t("ok")}
            </Button>
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
