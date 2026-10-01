"use client";

import { RotateCw, Users } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useChoresQuery } from "@/components/chores/use-chores";
import type { Chore } from "@/components/chores/types";
import { taskPictoOf } from "@/components/chores/task-picto";
import { TOD_PICTO } from "@/components/chores/time-of-day-header";
import { Skeleton } from "@/components/kids/state-views";
import { toneOf } from "@/components/kids/tone";
import { useIsWall } from "@/components/kids/use-is-wall";
import { useNow } from "@/components/kids/use-now";
import { Picto, type PictoName } from "@/components/pictos";
import { GlassCard } from "@/components/shared/glass-card";
import { MemberAvatar, type AvatarSize } from "@/components/shared/member-avatar";
import { columnSummary, type ColumnSummary } from "@/lib/chore-state";
import { cn } from "@/lib/utils";
import { WidgetHeader } from "./widget-header";

type WidgetMember = {
  id: string;
  name: string;
  color: string;
  emoji?: string | null;
};

type WidgetChoresProps = {
  className?: string;
  members: WidgetMember[];
};

const EMPTY_CHORES: Chore[] = [];

const AVATAR_PX: Record<AvatarSize, number> = { sm: 40, md: 56, lg: 72, xl: 96 };

/** Height of the star line under a name; the "for everyone" tile reserves the same room. */
const STARS_ROW = "h-8";

/** What sits under the avatar: the next chore's picture, or the state's symbol. */
function statusPicto(
  summary: ColumnSummary<Chore>,
): { name: PictoName; dim: boolean; pause?: boolean } | null {
  switch (summary.state) {
    case "active": {
      const next = summary.next;
      const name = next ? (taskPictoOf(next.icon, next.title) ?? "next") : "next";
      return { name, dim: false };
    }
    case "allDone":
      return { name: "celebrate", dim: false };
    case "night":
      return { name: "tod-night", dim: false };
    case "pause":
      return {
        name: summary.upcomingPhase ? TOD_PICTO[summary.upcomingPhase] : "tod-anytime",
        dim: true,
        pause: true,
      };
    case "empty":
      return null;
  }
}

export function WidgetChores({ className, members }: WidgetChoresProps) {
  const t = useTranslations("dashboard.widgets.chores");
  const tKids = useTranslations("kids");
  const wall = useIsWall();
  const now = useNow();
  const { data, isLoading, isError, refetch } = useChoresQuery();

  const chores = data?.chores ?? EMPTY_CHORES;
  const completions = data?.completionsToday;

  const summaries = useMemo(() => {
    const map = new Map<string, ColumnSummary<Chore>>();
    if (!now || !completions) return map;
    for (const m of members) map.set(m.id, columnSummary(m.id, chores, completions, now));
    return map;
  }, [members, chores, completions, now]);

  const anyone = useMemo(() => {
    const all = chores.filter((c) => c.memberId === null);
    const doneIds = new Set((completions ?? []).map((c) => c.choreId));
    return { total: all.length, open: all.filter((c) => !doneIds.has(c.id)) };
  }, [chores, completions]);

  const loading = isLoading || (Boolean(data) && now === null);
  const fatal = isError && !data;
  const avatarSize: AvatarSize = wall ? "xl" : members.length > 3 ? "md" : "lg";

  return (
    <GlassCard className={cn("flex flex-col gap-4 p-4 md:p-6", className)}>
      <WidgetHeader
        title={t("title")}
        action={
          fatal ? (
            <button
              type="button"
              onClick={() => void refetch()}
              aria-label={tKids("retry")}
              className={cn(
                "inline-flex size-12 items-center justify-center rounded-full bg-danger-tint text-danger-ink",
                "focus-ring-kid transition-transform duration-100 ease-snappy active:scale-95",
              )}
            >
              <RotateCw className="size-6" strokeWidth={2.5} />
            </button>
          ) : undefined
        }
      />

      {members.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{t("noMembers")}</p>
      ) : (
        <ul className="flex flex-wrap items-start justify-around gap-x-2 gap-y-4">
          {members.map((m) => (
            <li key={m.id}>
              {loading ? (
                <Placeholder member={m} size={avatarSize} />
              ) : (
                <MemberTile
                  member={m}
                  summary={summaries.get(m.id)}
                  balance={fatal ? null : (data?.balanceByMember[m.id]?.balance ?? 0)}
                  size={avatarSize}
                  failed={fatal}
                />
              )}
            </li>
          ))}
          {!loading && !fatal && anyone.total > 0 && (
            <li>
              <AnyoneTile open={anyone.open} size={avatarSize} />
            </li>
          )}
        </ul>
      )}
    </GlassCard>
  );
}

function Placeholder({ member, size }: { member: WidgetMember; size: AvatarSize }) {
  return (
    <div className="flex flex-col items-center gap-2 p-2">
      <MemberAvatar size={size} name={member.name} color={member.color} emoji={member.emoji} />
      <span className="kid-label line-clamp-1 max-w-28 break-words text-ink">{member.name}</span>
      <Skeleton className={cn(STARS_ROW, "w-16 rounded-full")} />
      <Skeleton className="size-12 rounded-full" />
    </div>
  );
}

type MemberTileProps = {
  member: WidgetMember;
  summary: ColumnSummary<Chore> | undefined;
  /** Stars since the last reset; null while the count is unknown. */
  balance: number | null;
  size: AvatarSize;
  /** Loading the chores failed: the avatar still leads to the person's list. */
  failed: boolean;
};

function MemberTile({ member, summary, balance, size, failed }: MemberTileProps) {
  const t = useTranslations("dashboard.widgets.chores");
  const tone = toneOf(member.color);
  const picto = summary ? statusPicto(summary) : null;

  let label = t("noChoresFor", { name: member.name });
  if (failed) {
    label = t("unknownFor", { name: member.name });
  } else if (summary) {
    if (summary.state === "allDone") label = t("allDoneFor", { name: member.name });
    else if (summary.state === "night") label = t("nightFor", { name: member.name });
    else if (summary.state === "pause") label = t("pauseFor", { name: member.name });
    else if (summary.state === "active") label = t("openFor", { name: member.name, count: summary.open });
  }
  if (balance !== null) label = `${label}, ${t("stars", { count: balance })}`;

  return (
    <Link
      href={`/chores?member=${encodeURIComponent(member.id)}`}
      aria-label={label}
      className={cn(
        "flex flex-col items-center gap-2 rounded-3xl p-2 focus-ring-kid",
        "transition-transform duration-100 ease-snappy active:scale-95",
      )}
    >
      <MemberAvatar
        size={size}
        name={member.name}
        color={member.color}
        emoji={member.emoji}
        progress={summary && summary.total > 0 ? { done: summary.done, total: summary.total } : undefined}
        openCount={summary && summary.total > 0 ? summary.open : undefined}
      />
      <span aria-hidden className={cn("kid-label line-clamp-1 max-w-28 break-words", tone.ink)}>
        {member.name}
      </span>
      <span
        aria-hidden
        className={cn("inline-flex items-center gap-1.5 rounded-full px-3", STARS_ROW, balance !== null && tone.tint)}
      >
        {balance !== null && (
          <>
            <Picto name="star" size={20} />
            <span className={cn("kid-number text-xl", tone.ink)}>{balance}</span>
          </>
        )}
      </span>
      <span
        aria-hidden
        className={cn(
          "flex size-14 items-center justify-center rounded-2xl",
          failed ? "bg-danger-tint" : picto ? tone.tint : "",
        )}
      >
        {failed ? (
          <Picto name="oops" size={44} />
        ) : (
          picto && (
            <span className="relative flex">
              <Picto name={picto.name} size={48} className={cn(picto.dim && "opacity-55")} />
              {picto.pause && (
                <span className="absolute -bottom-1.5 -right-2 flex size-6 items-center justify-center rounded-full bg-surface">
                  <Picto name="pause" size={20} />
                </span>
              )}
            </span>
          )
        )}
      </span>
    </Link>
  );
}

function AnyoneTile({ open, size }: { open: readonly Chore[]; size: AvatarSize }) {
  const t = useTranslations("dashboard.widgets.chores");
  const tChores = useTranslations("chores");
  const px = AVATAR_PX[size];
  const first = open[0];
  const picto: PictoName = first ? (taskPictoOf(first.icon, first.title) ?? "next") : "celebrate";

  return (
    <Link
      href="/chores"
      aria-label={t("anyoneFor", { count: open.length })}
      className={cn(
        "flex flex-col items-center gap-2 rounded-3xl p-2 focus-ring-kid",
        "transition-transform duration-100 ease-snappy active:scale-95",
      )}
    >
      <span
        aria-hidden
        className="relative flex items-center justify-center rounded-full border-2 border-dashed border-muted bg-surface text-ink"
        style={{ width: px, height: px }}
      >
        <Users style={{ width: px * 0.5, height: px * 0.5 }} strokeWidth={2} />
        {open.length > 0 && (
          <span
            className="kid-label tabular absolute -right-1 -top-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-surface bg-ink px-1 text-bg"
          >
            {open.length}
          </span>
        )}
      </span>
      <span aria-hidden className="kid-label line-clamp-1 max-w-28 break-words text-ink">
        {tChores("anyone")}
      </span>
      <span aria-hidden className={STARS_ROW} />
      <span aria-hidden className="flex size-14 items-center justify-center rounded-2xl bg-accent-sand-tint">
        <Picto name={picto} size={48} />
      </span>
    </Link>
  );
}
