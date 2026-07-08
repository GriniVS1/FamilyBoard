"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, MoonStar, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { GlassCard } from "@/components/shared/glass-card";
import { Switch } from "@/components/shared/switch";
import { cn } from "@/lib/utils";

type DisplaySleepSettings = {
  enabled: boolean;
  start: string;
  end: string;
};

const DEFAULT_SETTINGS: DisplaySleepSettings = {
  enabled: false,
  start: "22:00",
  end: "06:30",
};

const STEP_MINUTES = 15;
const MINUTES_PER_DAY = 24 * 60;

async function fetchDisplaySleep(): Promise<DisplaySleepSettings> {
  const res = await fetch("/api/settings/display-sleep", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed (${res.status})`);
  return (await res.json()) as DisplaySleepSettings;
}

async function patchDisplaySleep(
  patch: DisplaySleepSettings,
  adminPin: string,
): Promise<DisplaySleepSettings> {
  const res = await fetch("/api/settings/display-sleep", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Pin": adminPin },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed (${res.status})`);
  return (await res.json()) as DisplaySleepSettings;
}

function stepTime(value: string, deltaMinutes: number): string {
  const [h, m] = value.split(":").map(Number);
  const total = ((h * 60 + m + deltaMinutes) % MINUTES_PER_DAY + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const nextH = Math.floor(total / 60);
  const nextM = total % 60;
  return `${String(nextH).padStart(2, "0")}:${String(nextM).padStart(2, "0")}`;
}

type DisplaySleepCardProps = {
  adminPin: string;
};

export function DisplaySleepCard({ adminPin }: DisplaySleepCardProps) {
  const t = useTranslations("settings.displaySleep");
  const tSettings = useTranslations("settings");
  const queryClient = useQueryClient();

  const { data = DEFAULT_SETTINGS } = useQuery({
    queryKey: ["display-sleep"],
    queryFn: fetchDisplaySleep,
  });

  const { mutate, isPending, isSuccess } = useMutation({
    mutationFn: (next: DisplaySleepSettings) => patchDisplaySleep(next, adminPin),
    onSuccess: (next) => {
      queryClient.setQueryData(["display-sleep"], next);
    },
  });

  function update(patch: Partial<DisplaySleepSettings>) {
    mutate({ ...data, ...patch });
  }

  return (
    <GlassCard className="flex flex-col gap-4 p-6">
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-lilac/30 text-ink"
        >
          <MoonStar className="size-4" />
        </span>
        <div className="flex-1 space-y-1">
          <h2 className="font-display text-xl text-ink">{t("title")}</h2>
          <p className="text-sm text-muted">{t("hint")}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink">{t("toggle")}</div>
          <p className="text-xs text-muted">{t("toggleHint")}</p>
        </div>
        <Switch
          checked={data.enabled}
          onCheckedChange={(enabled) => update({ enabled })}
          disabled={isPending}
          aria-label={t("toggle")}
        />
      </div>

      <div
        className={cn(
          "grid grid-cols-1 gap-3 transition-opacity sm:grid-cols-2",
          !data.enabled && "opacity-50",
        )}
      >
        <TimeStepper
          label={t("from")}
          value={data.start}
          disabled={isPending || !data.enabled}
          onStep={(delta) => update({ start: stepTime(data.start, delta) })}
        />
        <TimeStepper
          label={t("to")}
          value={data.end}
          disabled={isPending || !data.enabled}
          onStep={(delta) => update({ end: stepTime(data.end, delta) })}
        />
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

type TimeStepperProps = {
  label: string;
  value: string;
  disabled?: boolean;
  onStep: (deltaMinutes: number) => void;
};

function TimeStepper({ label, value, disabled, onStep }: TimeStepperProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </span>
      <div className="flex items-center gap-1 rounded-2xl border border-border bg-surface p-1">
        <button
          type="button"
          onClick={() => onStep(-STEP_MINUTES)}
          disabled={disabled}
          aria-label={`${label} -${STEP_MINUTES}min`}
          className={cn(
            "tap-target inline-flex items-center justify-center rounded-xl text-ink",
            "hover:bg-bg transition-colors disabled:opacity-40",
          )}
        >
          <Minus className="size-4" />
        </button>
        <span className="min-w-[4.5rem] flex-1 text-center font-display text-lg tabular text-ink">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onStep(STEP_MINUTES)}
          disabled={disabled}
          aria-label={`${label} +${STEP_MINUTES}min`}
          className={cn(
            "tap-target inline-flex items-center justify-center rounded-xl text-ink",
            "hover:bg-bg transition-colors disabled:opacity-40",
          )}
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}
