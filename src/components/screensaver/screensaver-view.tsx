"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { endOfDay, format, startOfDay } from "date-fns";
import { useTranslations } from "next-intl";
import type { CalendarEvent } from "@/components/calendar/types";
import type { Photo } from "@/components/photos/types";
import { cn } from "@/lib/utils";

type Origin = { x: number; y: number };

const PHOTO_INTERVAL_MS = 8000;

async function fetchPhotos(): Promise<Photo[]> {
  const res = await fetch("/api/photos", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed (${res.status})`);
  return (await res.json()) as Photo[];
}

async function fetchTodayEvents(): Promise<CalendarEvent[]> {
  const now = new Date();
  const params = new URLSearchParams({
    from: startOfDay(now).toISOString(),
    to: endOfDay(now).toISOString(),
  });
  const res = await fetch(`/api/events?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed (${res.status})`);
  return (await res.json()) as CalendarEvent[];
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function randomOrigin(): Origin {
  return {
    x: Math.round(Math.random() * 100),
    y: Math.round(Math.random() * 100),
  };
}

export function ScreensaverView() {
  const t = useTranslations("screensaver");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [index, setIndex] = useState(0);
  const [origin, setOrigin] = useState<Origin>({ x: 50, y: 50 });

  const { data: photos = [] } = useQuery({
    queryKey: ["photos"],
    queryFn: fetchPhotos,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events-today"],
    queryFn: fetchTodayEvents,
    staleTime: 60_000,
  });

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (photos.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % photos.length);
      setOrigin(randomOrigin());
    }, PHOTO_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [photos.length]);

  useEffect(() => {
    setOrigin(randomOrigin());
  }, [index]);

  const nextEvent = useMemo(() => {
    if (!now) return null;
    const nowTime = now.getTime();
    return (
      events
        .filter((e) => new Date(e.endsAt).getTime() >= nowTime)
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        )[0] ?? null
    );
  }, [events, now]);

  function handleExit() {
    router.push("/");
  }

  const current = photos[index] ?? null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t("exit")}
      onClick={handleExit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
          e.preventDefault();
          handleExit();
        }
      }}
      className={cn(
        "relative h-dvh w-screen overflow-hidden bg-black text-white",
        "cursor-default focus:outline-none",
      )}
    >
      {photos.length === 0 ? (
        <FallbackBackground />
      ) : current ? (
        <AnimatePresence>
          <motion.div
            key={current.id}
            initial={{ opacity: 0, scale: 1.0 }}
            animate={{ opacity: 1, scale: 1.08 }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: 1.2, ease: "easeInOut" },
              scale: { duration: PHOTO_INTERVAL_MS / 1000, ease: "linear" },
            }}
            className="absolute inset-0"
            style={{ transformOrigin: `${origin.x}% ${origin.y}%` }}
          >
            <img
              src={current.path}
              alt={current.caption ?? ""}
              className="h-full w-full object-cover"
            />
            <div
              className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70"
              aria-hidden
            />
          </motion.div>
        </AnimatePresence>
      ) : null}

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <div className="flex items-start justify-between p-8 sm:p-12">
          <div />
          {nextEvent && (
            <div
              className={cn(
                "rounded-3xl border border-white/20 bg-black/40 px-4 py-3 backdrop-blur-md",
                "text-white shadow-soft",
              )}
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                {t("nextUp")}
              </div>
              <div className="mt-1 max-w-[260px] truncate text-base font-medium">
                {nextEvent.title}
              </div>
              <div className="tabular text-xs text-white/80">
                {nextEvent.allDay
                  ? tCommon("allDay")
                  : `${format(new Date(nextEvent.startsAt), "HH:mm")} – ${format(
                      new Date(nextEvent.endsAt),
                      "HH:mm",
                    )}`}
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between p-8 sm:p-12">
          <div className="text-white drop-shadow-lg">
            <div
              className="font-display text-7xl tabular leading-none tracking-tight sm:text-8xl"
              suppressHydrationWarning
            >
              {now ? formatTime(now) : "--:--"}
            </div>
            <div
              className="mt-3 font-display text-lg text-white/80"
              suppressHydrationWarning
            >
              {now ? formatLongDate(now) : ""}
            </div>
          </div>
          {photos.length === 0 && (
            <div className="text-right text-white/70">
              <div className="text-xs">{t("tapToExit")}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FallbackBackground() {
  return (
    <div
      aria-hidden
      className={cn(
        "absolute inset-0",
        "bg-gradient-to-br from-accent-peach via-accent-rose to-accent-lilac",
        "dark:from-accent-rose dark:via-accent-lilac dark:to-accent-sky",
      )}
    />
  );
}
