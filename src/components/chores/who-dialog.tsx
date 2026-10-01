"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toneOf } from "@/components/kids/tone";
import { Picto } from "@/components/pictos";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/shared/dialog";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { cn } from "@/lib/utils";
import { taskPictoOf } from "./task-picto";
import type { Chore, ChoreMember } from "./types";

type WhoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chore: Chore | null;
  members: readonly ChoreMember[];
  onPick: (memberId: string) => void;
};

/** "Who did it?" for a chore nobody owns: the picture and the faces carry it, no typing. */
export function WhoDialog({ open, onOpenChange, chore, members, onPick }: WhoDialogProps) {
  const t = useTranslations("chores");
  const picto = chore ? taskPictoOf(chore.icon, chore.title) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(600px,calc(100vw-2rem))]" showClose={false}>
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="flex size-24 shrink-0 items-center justify-center rounded-3xl bg-accent-sand-tint"
            >
              {picto ? (
                <Picto name={picto} size={72} />
              ) : chore?.icon ? (
                <span className="text-6xl leading-none">{chore.icon}</span>
              ) : (
                <Picto name="star" size={72} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="kid-heading">{t("whoTitle")}</DialogTitle>
              <DialogDescription className="kid-body mt-1 line-clamp-2 break-words text-muted">
                {chore?.title}
              </DialogDescription>
            </div>
            <DialogClose
              className={cn(
                "inline-flex size-12 shrink-0 items-center justify-center self-start rounded-full",
                "border-2 border-border bg-surface text-ink focus-ring-kid",
              )}
              aria-label={t("close")}
            >
              <X className="size-6" strokeWidth={2.5} />
            </DialogClose>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {members.map((m) => {
              const tone = toneOf(m.color);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onPick(m.id)}
                  aria-label={t("whoPick", { name: m.name })}
                  className={cn(
                    "flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-3xl p-3",
                    "shadow-pop focus-ring-kid",
                    "transition-transform duration-100 ease-snappy active:translate-y-0.5 active:shadow-press",
                    tone.tint,
                  )}
                >
                  <MemberAvatar size="lg" name={m.name} color={m.color} emoji={m.emoji} onTint />
                  <span className={cn("kid-title line-clamp-1 break-words", tone.ink)}>{m.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
