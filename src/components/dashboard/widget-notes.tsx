"use client";

import { useQuery, type QueryKey } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Pin, StickyNote } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { cn, isMemberColor, type MemberColor } from "@/lib/utils";
import type { Note } from "@/components/notes/types";
import { NOTE_TINT } from "@/components/notes/types";
import { WidgetHeader } from "./widget-header";

type WidgetNotesProps = {
  className?: string;
};

const QUERY_KEY: QueryKey = ["notes"];

async function fetchNotes(): Promise<Note[]> {
  const res = await fetch("/api/notes", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load notes (${res.status})`);
  }
  return (await res.json()) as Note[];
}

export function WidgetNotes({ className }: WidgetNotesProps) {
  const t = useTranslations("dashboard.widgets.notes");
  const { data: notes = [], isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchNotes,
    staleTime: 60_000,
    // The kiosk mounts this once and never refocuses — poll so phone-made
    // changes appear without waiting for a screensaver cycle.
    refetchInterval: 60_000,
  });

  const pinned = notes
    .filter((n) => n.pinned)
    .sort(
      (a, b) =>
        new Date(b.updatedAt ?? b.createdAt).getTime() -
        new Date(a.updatedAt ?? a.createdAt).getTime(),
    )
    .slice(0, 4);

  return (
    <GlassCard className={cn("p-6 flex flex-col gap-4", className)}>
      <WidgetHeader
        title={t("title")}
        action={
          <span className="tabular text-xs text-muted">
            {t("pinnedCount", { count: notes.filter((n) => n.pinned).length })}
          </span>
        }
      />
      <div
        className="flex-1"
        aria-label={t("title")}
      >
        {isLoading && (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
            {t("empty")}
          </div>
        )}
        {!isLoading && error && (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-accent-rose/40 px-4 py-10 text-center text-sm text-accent-rose">
            {t("couldNotLoad")}
          </div>
        )}
        {!isLoading && !error && pinned.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
            <StickyNote className="size-5" />
            {t("empty")}
          </div>
        )}
        {pinned.length > 0 && (
          <div className="columns-1 gap-3 sm:columns-2">
            {pinned.map((n) => {
              const safeColor: MemberColor = isMemberColor(n.color)
                ? n.color
                : "sun";
              return (
                <div
                  key={n.id}
                  className={cn(
                    "mb-3 break-inside-avoid rounded-2xl border border-border p-3",
                    "shadow-soft",
                    NOTE_TINT[safeColor],
                  )}
                >
                  <div className="mb-1 flex items-center gap-1.5 text-ink/70">
                    <Pin className="size-3 fill-current" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider">
                      {t("pinned")}
                    </span>
                  </div>
                  <p className="line-clamp-4 whitespace-pre-wrap text-sm text-ink">
                    {n.body}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
