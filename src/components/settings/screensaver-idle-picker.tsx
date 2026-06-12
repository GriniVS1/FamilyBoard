"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Monitor } from "lucide-react";
import { useTranslations } from "next-intl";
import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";

type IdleOption = {
  value: number;
  labelKey: "never" | "minute" | "minutes";
  n?: number;
};

const OPTIONS: IdleOption[] = [
  { value: 0, labelKey: "never" },
  { value: 1, labelKey: "minute" },
  { value: 3, labelKey: "minutes", n: 3 },
  { value: 5, labelKey: "minutes", n: 5 },
  { value: 10, labelKey: "minutes", n: 10 },
  { value: 15, labelKey: "minutes", n: 15 },
  { value: 30, labelKey: "minutes", n: 30 },
];

async function fetchIdleMinutes(): Promise<number> {
  const res = await fetch("/api/settings/screensaver-idle", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed (${res.status})`);
  const data = (await res.json()) as { minutes: number };
  return data.minutes;
}

async function patchIdleMinutes(minutes: number, adminPin: string): Promise<number> {
  const res = await fetch("/api/settings/screensaver-idle", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Pin": adminPin },
    body: JSON.stringify({ minutes }),
  });
  if (!res.ok) throw new Error(`Failed (${res.status})`);
  const data = (await res.json()) as { minutes: number };
  return data.minutes;
}

type ScreensaverIdlePickerProps = {
  adminPin: string;
};

export function ScreensaverIdlePicker({ adminPin }: ScreensaverIdlePickerProps) {
  const t = useTranslations("settings.screensaver");
  const tSettings = useTranslations("settings");
  const queryClient = useQueryClient();

  const { data: current = 3 } = useQuery({
    queryKey: ["screensaver-idle"],
    queryFn: fetchIdleMinutes,
  });

  const { mutate, isPending, isSuccess } = useMutation({
    mutationFn: (minutes: number) => patchIdleMinutes(minutes, adminPin),
    onSuccess: (minutes) => {
      queryClient.setQueryData(["screensaver-idle"], minutes);
    },
  });

  function labelFor(opt: IdleOption): string {
    if (opt.labelKey === "never") return t("never");
    if (opt.labelKey === "minute") return t("minute");
    return t("minutes", { n: opt.n ?? opt.value });
  }

  return (
    <GlassCard className="flex flex-col gap-4 p-6">
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-lilac/30 text-ink"
        >
          <Monitor className="size-4" />
        </span>
        <div className="flex-1 space-y-1">
          <h2 className="font-display text-xl text-ink">{t("title")}</h2>
          <p className="text-sm text-muted">{t("idleHint")}</p>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          {t("idle")}
        </div>
        <div className="flex flex-wrap gap-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => mutate(opt.value)}
              disabled={isPending}
              className={cn(
                "tap-target rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
                current === opt.value
                  ? "border-ink bg-ink text-bg"
                  : "border-border bg-surface text-ink hover:bg-bg",
                "disabled:opacity-50",
              )}
            >
              {labelFor(opt)}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {isSuccess && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs text-accent-mint"
            role="status"
          >
            {tSettings("saved")}
          </motion.p>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
