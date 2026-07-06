"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  Loader2,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";
import { WidgetHeader } from "./widget-header";

type WeatherNow = {
  tempC: number;
  code: number;
  isDay: boolean;
  windKmh: number;
};

// Field names must match /api/weather's response exactly (ts/maxC/minC —
// a silent mismatch here renders as NaN on the wall).
type WeatherHourly = {
  ts: string;
  tempC: number;
  code: number;
  isDay: boolean;
};

type WeatherDaily = {
  date: string;
  maxC: number;
  minC: number;
  code: number;
};

type WeatherPayload = {
  label: string;
  now: WeatherNow;
  hourly: WeatherHourly[];
  daily: WeatherDaily[];
};

type WeatherError = {
  error: { code: string; message: string };
};

type WidgetWeatherProps = {
  className?: string;
  location?: string | null;
};

async function fetchWeather(): Promise<WeatherPayload> {
  const res = await fetch("/api/weather", { cache: "no-store" });
  if (!res.ok) {
    let code = "WEATHER_ERROR";
    let message = `Weather failed (${res.status})`;
    try {
      const data = (await res.json()) as WeatherError;
      if (data?.error?.code) code = data.error.code;
      if (data?.error?.message) message = data.error.message;
    } catch {
      // ignore
    }
    const err = new Error(message);
    (err as Error & { code?: string }).code = code;
    throw err;
  }
  return (await res.json()) as WeatherPayload;
}

function iconForCode(code: number, isDay: boolean): LucideIcon {
  if (code === 0) return isDay ? Sun : Moon;
  if (code === 1 || code === 2) return isDay ? Sun : CloudMoon;
  if (code === 3) return Cloud;
  if (code >= 45 && code <= 48) return CloudFog;
  if (code >= 51 && code <= 67) return CloudRain;
  if (code >= 71 && code <= 77) return CloudSnow;
  if (code >= 80 && code <= 82) return CloudRain;
  if (code === 85 || code === 86) return CloudSnow;
  if (code >= 95) return CloudLightning;
  return Cloud;
}

function shortTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}`;
}

export function WidgetWeather({ className, location }: WidgetWeatherProps) {
  const t = useTranslations("dashboard.widgets.weather");
  const { data, isLoading, error } = useQuery({
    queryKey: ["weather"],
    queryFn: fetchWeather,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const code = (error as (Error & { code?: string }) | null)?.code;
  const notConfigured =
    code === "WEATHER_NOT_CONFIGURED" ||
    (!data && !isLoading && !location);

  return (
    <GlassCard
      className={cn(
        "p-6 flex flex-col gap-4 bg-accent-sky/30 dark:bg-accent-sky/20",
        className,
      )}
    >
      <WidgetHeader title={t("now")} />
      {isLoading ? (
        <div className="flex flex-1 items-center gap-3 text-muted">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">{t("now")}</span>
        </div>
      ) : notConfigured ? (
        <div className="flex flex-1 flex-col items-start justify-center gap-2">
          <p className="text-sm text-ink/80">
            {t("notConfigured")}
          </p>
          <Link
            href="/settings"
            className="text-sm font-medium text-ink underline-offset-2 hover:underline"
          >
            {t("openSettings")}
          </Link>
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-sm text-accent-rose">
            {error instanceof Error
              ? error.message
              : t("couldNotLoad")}
          </p>
        </div>
      ) : data ? (
        <WeatherContent data={data} />
      ) : null}
      <span className="text-xs text-muted">
        {data?.label ?? location ?? t("setLocation")}
      </span>
    </GlassCard>
  );
}

function WeatherContent({ data }: { data: WeatherPayload }) {
  const t = useTranslations("dashboard.widgets.weather");
  const NowIcon = iconForCode(data.now.code, data.now.isDay);
  const hourly = data.hourly.slice(0, 6);
  const daily = data.daily.slice(0, 3);

  function shortDay(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center gap-4">
        <span
          className="inline-flex size-14 items-center justify-center rounded-2xl bg-accent-sun/50 text-ink"
          aria-hidden
        >
          <NowIcon className="size-8" strokeWidth={1.75} />
        </span>
        <div className="flex flex-col">
          <span className="font-display text-4xl tabular leading-none tracking-tight text-ink">
            {Math.round(data.now.tempC)}°
          </span>
          <span className="mt-1 tabular text-xs text-ink/70">
            {t("wind", { speed: Math.round(data.now.windKmh) })}
          </span>
        </div>
      </div>

      {hourly.length > 0 && (
        <ul
          className="flex items-end justify-between gap-1 pt-1"
          aria-label={t("now")}
        >
          {hourly.map((h) => {
            const Icon = iconForCode(h.code, h.isDay);
            return (
              <li
                key={h.ts}
                className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center"
              >
                <span className="tabular text-[10px] text-ink/70">
                  {shortTime(h.ts)}
                </span>
                <Icon className="size-4 text-ink/80" strokeWidth={1.75} />
                <span className="tabular text-xs text-ink">
                  {Math.round(h.tempC)}°
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {daily.length > 0 && (
        <ul
          className="flex items-center justify-between gap-2 border-t border-border/50 pt-3"
          aria-label={t("high")}
        >
          {daily.map((d) => {
            const Icon = iconForCode(d.code, true);
            return (
              <li
                key={d.date}
                className="flex min-w-0 flex-1 items-center justify-center gap-1.5"
              >
                <span className="text-xs text-ink/70">{shortDay(d.date)}</span>
                <Icon className="size-4 text-ink/80" strokeWidth={1.75} />
                <span className="tabular text-xs text-ink">
                  {Math.round(d.maxC)}°
                </span>
                <span className="tabular text-[10px] text-ink/50">
                  {Math.round(d.minC)}°
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
