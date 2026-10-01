"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ToastShell } from "@/components/kids/kid-toast";
import { UndoButton } from "@/components/kids/undo-button";
import { Picto } from "@/components/pictos";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { UNDO_ARM_MS } from "@/lib/undo-guard";
import { taskPictoOf } from "./task-picto";
import type { Chore, ChoreMember } from "./types";

export type DoneEntry = {
  key: number;
  chore: Chore;
  memberId: string;
  expiresAt: number;
};

/** Two siblings can tick within one window, so there are two fixed places. */
export type DoneSlots = readonly [DoneEntry | null, DoneEntry | null];

type DoneToastProps = {
  slots: DoneSlots;
  members: readonly ChoreMember[];
  centerOn?: string;
  lift?: boolean;
  onUndo: (chore: Chore) => void;
  onExpire: (slot: 0 | 1, key: number) => void;
};

/**
 * Undo for what was just ticked. Each entry has its own ↶ with its own
 * countdown. The places never reshuffle: A stays left, B stays right, and an
 * entry that ends just leaves its place empty, so a finger aimed at a ↶ never
 * finds another task's ↶ under it.
 */
export function DoneToast({ slots, members, centerOn, lift, onUndo, onExpire }: DoneToastProps) {
  const [first, second] = slots;
  if (!first && !second) return null;
  const alone = first && !second ? first : !first && second ? second : null;
  const reward = alone && (
    <div className="flex items-center justify-center gap-1 text-success-ink">
      <Picto name="star" size={28} />
      <span className="kid-number">+{alone.chore.points}</span>
    </div>
  );

  return (
    <ToastShell tone="success" centerOn={centerOn} lift={lift}>
      <div className="grid w-full grid-cols-2 items-center gap-4">
        {first ? (
          <Slot key={first.key} slot={0} entry={first} members={members} onUndo={onUndo} onExpire={onExpire} />
        ) : (
          reward
        )}
        {second ? (
          <Slot key={second.key} slot={1} entry={second} members={members} onUndo={onUndo} onExpire={onExpire} />
        ) : (
          reward
        )}
      </div>
    </ToastShell>
  );
}

type SlotProps = {
  slot: 0 | 1;
  entry: DoneEntry;
  members: readonly ChoreMember[];
  onUndo: (chore: Chore) => void;
  onExpire: (slot: 0 | 1, key: number) => void;
};

function Slot({ slot, entry, members, onUndo, onExpire }: SlotProps) {
  const t = useTranslations("chores");
  const [remaining] = useState(() => Math.max(0, entry.expiresAt - Date.now()));
  const { key, expiresAt } = entry;

  useEffect(() => {
    const timer = window.setTimeout(() => onExpire(slot, key), Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [key, expiresAt, slot, onExpire]);

  const member = members.find((m) => m.id === entry.memberId);
  const picto = taskPictoOf(entry.chore.icon, entry.chore.title) ?? "celebrate";

  return (
    <div className="flex min-w-0 items-center gap-2">
      <UndoButton
        onClick={() => onUndo(entry.chore)}
        color={member?.color}
        countdownMs={remaining}
        appearAfterMs={UNDO_ARM_MS}
        label={t("undoTask", { title: entry.chore.title })}
      />
      <Picto name={picto} size={44} />
      {member && (
        <MemberAvatar size="sm" name={member.name} color={member.color} emoji={member.emoji} />
      )}
      <span className="sr-only">
        {t("toast.stars", { name: member?.name ?? "", count: entry.chore.points })}
      </span>
    </div>
  );
}
