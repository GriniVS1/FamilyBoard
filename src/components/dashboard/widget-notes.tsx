"use client";

import { useQuery, type QueryKey } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Pin } from "lucide-react";
import { EmptyState, ErrorState, Skeleton } from "@/components/kids/state-views";
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
    throw new Error(`notes ${res.status}`);
  }
  return (await res.json()) as Note[];
}

export function WidgetNotes({ className }: WidgetNotesProps) {
  const t = useTranslations("dashboard.widgets.notes");
  const { data: notes = [], isLoading, isError, refetch } = useQuery({
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
          <span className="tabular text-sm text-muted">
            {t("pinnedCount", { count: notes.filter((n) => n.pinned).length })}
          </span>
        }
      />
      <div className="flex-1" aria-label={t("title")}>
        {isLoading && (
          <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        )}
        {isError && !isLoading && (
          <ErrorState size="md" onRetry={() => void refetch()} detail={t("couldNotLoad")} />
        )}
        {!isLoading && !isError && pinned.length === 0 && (
          <EmptyState size="md" picto="nav-notes" title={t("empty")} />
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
                  <div className="mb-1 flex items-center gap-1.5 text-ink">
                    <Pin className="size-4 fill-current" aria-hidden />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      {t("pinned")}
                    </span>
                  </div>
                  <p className="kid-body line-clamp-4 whitespace-pre-wrap text-ink">
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
