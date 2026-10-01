"use client";

import { ArrowRight, ChevronDown, RotateCcw } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ChoreMember, MemberPoints } from "@/components/chores/types";
import { ConfirmDialog } from "@/components/kids/confirm-dialog";
import { useParentMode } from "@/components/kids/parent-mode";
import { EmptyState, ErrorState, Skeleton } from "@/components/kids/state-views";
import { toneOf } from "@/components/kids/tone";
import { useIsWall } from "@/components/kids/use-is-wall";
import { useRestoreFocus } from "@/components/kids/use-restore-focus";
import { Picto } from "@/components/pictos";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/shared/dialog";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { cn } from "@/lib/utils";
import { usePointsQuery } from "./use-points";

type PointsOverviewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: readonly ChoreMember[];
  /** Resolves once the request is answered; failures surface as the page's toast, not here. */
  onReset: (memberIds: string[]) => Promise<void>;
};

type Row = { member: ChoreMember; points: MemberPoints };

type Formats = { day: Intl.DateTimeFormat; stamp: Intl.DateTimeFormat };

/**
 * A touch tap on the confirmation is judged by Radix only on its `click`, after
 * the confirmation has unmounted. By then the overview is the top layer again
 * and would read the tap as one outside itself and close.
 */
function keepOpenForNestedDialog(event: { detail: { originalEvent: PointerEvent }; preventDefault: () => void }) {
  const target = event.detail.originalEvent.target;
  if (target instanceof Element && target.closest("[role=dialog]")) event.preventDefault();
}

const SECONDARY_BUTTON = cn(
  "inline-flex h-12 items-center justify-center gap-2 rounded-full border-2 border-border bg-surface px-5",
  "kid-label text-ink shadow-pop focus-ring-kid",
  "transition-transform duration-100 ease-snappy active:translate-y-0.5 active:shadow-press",
  "disabled:opacity-50 disabled:shadow-none disabled:active:translate-y-0",
);

export function PointsOverview({ open, onOpenChange, members, onReset }: PointsOverviewProps) {
  const t = useTranslations("points");
  const { active } = useParentMode();
  const [confirm, setConfirm] = useState<Row[] | null>(null);
  const restoreFocus = useRestoreFocus();

  // Parent mode ending (timeout or "Fertig") takes the dialogs with it.
  useEffect(() => {
    if (active) return;
    onOpenChange(false);
    setConfirm(null);
  }, [active, onOpenChange]);

  async function confirmReset() {
    if (!confirm) return;
    // The overview closes either way so the toast with ↶ or ↻ is not hidden behind its overlay.
    await onReset(confirm.map((r) => r.member.id));
    onOpenChange(false);
  }

  const single = confirm?.length === 1 ? confirm[0] : undefined;

  return (
    <>
      <Dialog open={open && active} onOpenChange={onOpenChange}>
        <DialogContent
          {...restoreFocus}
          onPointerDownOutside={keepOpenForNestedDialog}
          className={cn(
            "flex w-[min(960px,calc(100vw-2rem))] flex-col gap-4 overflow-hidden",
            "data-[state=open]:animate-fade-in max-md:data-[state=open]:animate-slide-up",
            "max-md:bottom-0 max-md:left-0 max-md:top-auto max-md:max-h-[92dvh] max-md:w-full",
            "max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:rounded-t-3xl",
            "max-md:px-4 max-md:pb-[max(1rem,env(safe-area-inset-bottom))] max-md:pt-5",
          )}
        >
          <header className="shrink-0 pr-12">
            <DialogTitle className="kid-heading flex items-center gap-2">
              <Picto name="star" size={36} />
              <span>{t("title")}</span>
            </DialogTitle>
            <DialogDescription className="mt-1">{t("hint")}</DialogDescription>
          </header>
          <PointsPanel members={members} onAskReset={setConfirm} />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        icon={RotateCcw}
        title={single ? t("confirmOne", { name: single.member.name }) : t("confirmAll")}
        preview={
          single ? (
            <MemberAvatar
              size="xl"
              name={single.member.name}
              color={single.member.color}
              emoji={single.member.emoji}
            />
          ) : (
            <Picto name="star" size={88} />
          )
        }
        description={confirm && <ConfirmSummary rows={confirm} />}
        confirmLabel={t("reset")}
        onConfirm={confirmReset}
      />
    </>
  );
}

function ConfirmSummary({ rows }: { rows: Row[] }) {
  const t = useTranslations("points");
  const [only] = rows;

  return (
    <div className="flex flex-col items-center gap-3">
      {rows.length === 1 ? (
        <span className="inline-flex items-center gap-2 text-ink">
          <Picto name="star" size={32} />
          <span className="kid-number text-3xl">{only.points.balance}</span>
          <ArrowRight className="size-6 text-muted" strokeWidth={2.5} aria-hidden />
          <span className="kid-number text-3xl">0</span>
        </span>
      ) : (
        <ul className="flex flex-wrap justify-center gap-2">
          {rows.map(({ member, points }) => (
            <li
              key={member.id}
              className={cn("inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3", toneOf(member.color).tint)}
            >
              <MemberAvatar size="sm" name={member.name} color={member.color} emoji={member.emoji} />
              <Picto name="star" size={20} />
              <span className="kid-label tabular text-ink">{points.balance}</span>
            </li>
          ))}
        </ul>
      )}
      <span>{t("confirmHint")}</span>
    </div>
  );
}

type PointsPanelProps = {
  members: readonly ChoreMember[];
  onAskReset: (rows: Row[]) => void;
};

function PointsPanel({ members, onAskReset }: PointsPanelProps) {
  const t = useTranslations("points");
  const tKids = useTranslations("kids");
  const locale = useLocale();
  const wall = useIsWall();
  const { data, isPending, isError, refetch } = usePointsQuery();

  const formats = useMemo<Formats>(
    () => ({
      day: new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }),
      stamp: new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }),
    [locale],
  );

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const byId = new Map(members.map((m) => [m.id, m]));
    return data.members.flatMap((points) => {
      const member = byId.get(points.memberId);
      return member ? [{ member, points }] : [];
    });
  }, [data, members]);

  const resettable = rows.filter((r) => r.points.balance > 0);

  if (isPending) {
    return (
      <div role="status" aria-busy="true" className="flex min-h-0 flex-col gap-3">
        <span className="sr-only">{tKids("loading")}</span>
        <Skeleton className="h-40 rounded-3xl md:h-[104px]" />
        <Skeleton className="h-40 rounded-3xl md:h-[104px]" />
        <Skeleton className="h-40 rounded-3xl md:h-[104px]" />
      </div>
    );
  }

  if (isError && !data) {
    return <ErrorState size="md" onRetry={() => void refetch()} detail={t("couldNotLoad")} />;
  }

  if (rows.length === 0) {
    return <EmptyState size="md" title={t("empty")} />;
  }

  return (
    <>
      <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain">
        {rows.map((row) => (
          <PointsRow
            key={row.member.id}
            row={row}
            formats={formats}
            avatarSize={wall ? "lg" : "md"}
            onReset={() => onAskReset([row])}
          />
        ))}
      </ul>
      {rows.length > 1 && (
        <div className="flex shrink-0 justify-end">
          <button
            type="button"
            disabled={resettable.length === 0}
            onClick={() => onAskReset(resettable)}
            className={cn(SECONDARY_BUTTON, "w-full md:w-auto")}
          >
            <RotateCcw className="size-5" strokeWidth={2.5} aria-hidden />
            <span>{t("resetAll")}</span>
          </button>
        </div>
      )}
    </>
  );
}

type PointsRowProps = {
  row: Row;
  formats: Formats;
  avatarSize: "md" | "lg";
  onReset: () => void;
};

function PointsRow({ row, formats, avatarSize, onReset }: PointsRowProps) {
  const t = useTranslations("points");
  const { member, points } = row;
  const tone = toneOf(member.color);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyId = useId();
  const hasHistory = points.history.length > 0;
  const since = points.since
    ? t("sinceDate", { date: formats.day.format(new Date(points.since)) })
    : t("sinceStart");

  return (
    <li
      className={cn(
        "grid shrink-0 items-center gap-x-3 gap-y-3 rounded-3xl p-3 md:p-4",
        "grid-cols-[auto_minmax(0,1fr)_auto] [grid-template-areas:'avatar_name_number'_'chips_chips_chips'_'history_history_reset'_'list_list_list']",
        "md:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] md:gap-x-4 md:gap-y-2",
        "md:[grid-template-areas:'avatar_name_history_number_reset'_'avatar_chips_chips_number_reset'_'list_list_list_list_list']",
        tone.tint,
      )}
    >
      <span className="[grid-area:avatar]">
        <MemberAvatar
          size={avatarSize}
          name={member.name}
          color={member.color}
          emoji={member.emoji}
          onTint
        />
      </span>
      <span className={cn("kid-title-lg line-clamp-2 break-words [grid-area:name]", tone.ink)}>
        {member.name}
      </span>
      <span
        role="img"
        aria-label={t("stars", { count: points.balance })}
        className="inline-flex h-14 items-center gap-2 justify-self-end rounded-full bg-surface px-4 [grid-area:number]"
      >
        <Picto name="star" size={32} />
        <span aria-hidden className="kid-number text-4xl text-ink">
          {points.balance}
        </span>
      </span>

      <ul className="flex flex-wrap gap-2 [grid-area:chips]">
        {[t("week", { count: points.weekly }), t("total", { count: points.allTime }), since].map((text) => (
          <li
            key={text}
            className="kid-label tabular inline-flex h-8 items-center rounded-full bg-surface/80 px-3 text-ink"
          >
            {text}
          </li>
        ))}
      </ul>

      {hasHistory && (
        <button
          type="button"
          onClick={() => setHistoryOpen((o) => !o)}
          aria-expanded={historyOpen}
          aria-controls={historyId}
          className={cn(
            "inline-flex h-12 items-center gap-1 justify-self-start rounded-full bg-surface/70 pl-4 pr-3 [grid-area:history]",
            "kid-label text-ink focus-ring-kid transition-transform duration-100 ease-snappy active:scale-95",
          )}
        >
          <span>{t("history")}</span>
          <ChevronDown
            className={cn("size-5 transition-transform duration-kid ease-pop", historyOpen && "rotate-180")}
            strokeWidth={2.5}
            aria-hidden
          />
        </button>
      )}
      <button
        type="button"
        disabled={points.balance === 0}
        onClick={onReset}
        aria-label={t("resetFor", { name: member.name })}
        className={cn(
          SECONDARY_BUTTON,
          "justify-self-end [grid-area:reset]",
          !hasHistory && "max-md:[grid-column:1/-1] max-md:justify-self-stretch",
        )}
      >
        <RotateCcw className="size-5" strokeWidth={2.5} aria-hidden />
        <span>{t("reset")}</span>
      </button>

      {hasHistory && historyOpen && (
        <ul id={historyId} className="flex flex-col gap-2 rounded-2xl bg-surface/70 p-3 [grid-area:list]">
          {points.history.map((entry) => (
            <li key={entry.id} className="kid-label text-ink">
              <span className="sr-only">
                {t("historyEntry", {
                  date: formats.stamp.format(new Date(entry.resetAt)),
                  count: entry.points,
                })}
              </span>
              <span aria-hidden className="flex items-center gap-2">
                <time dateTime={entry.resetAt} className="tabular text-muted">
                  {formats.stamp.format(new Date(entry.resetAt))}
                </time>
                <span className="text-muted">·</span>
                <Picto name="star" size={20} />
                <span className="tabular">{entry.points}</span>
                <span>{t("historyReset")}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
