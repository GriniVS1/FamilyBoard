"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { toneOf } from "@/components/kids/tone";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { cn } from "@/lib/utils";
import type { CalendarMember } from "./types";

type MemberFilterProps = {
  members: CalendarMember[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

// Solo semantics: tapping a person shows only that person; tapping them again
// (or "All") brings everyone back. A child who taps their own face must see
// their own appointments, not lose them.
export function MemberFilter({ members, selectedIds, onChange }: MemberFilterProps) {
  const t = useTranslations("calendar");
  const allSelected = selectedIds.length === members.length;

  function toggle(id: string) {
    const isSolo = selectedIds.length === 1 && selectedIds[0] === id;
    onChange(isSolo ? members.map((m) => m.id) : [id]);
  }

  function selectAll() {
    onChange(members.map((m) => m.id));
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("members")}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.96 }}
        onClick={selectAll}
        className={cn(
          "inline-flex h-14 w-14 items-center justify-center gap-2 rounded-full border-2 sm:w-auto sm:px-5",
          "kid-label transition-colors duration-kid focus-ring-kid",
          allSelected
            ? "border-ink bg-ink text-bg shadow-pop"
            : "border-border bg-surface text-ink",
        )}
        aria-pressed={allSelected}
        aria-label={t("everyone")}
      >
        <Users className="size-6 sm:size-5" strokeWidth={2.25} aria-hidden />
        <span className="hidden sm:inline">{t("everyone")}</span>
      </motion.button>
      {members.map((m) => {
        const solo = !allSelected && selectedIds.includes(m.id);
        const tone = toneOf(m.color);
        return (
          <motion.button
            key={m.id}
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => toggle(m.id)}
            className={cn(
              "inline-flex h-14 items-center gap-2 rounded-full border-2 py-1 pl-1 pr-2 sm:pr-5",
              "kid-label transition-[background-color,border-color,opacity] duration-kid focus-ring-kid",
              solo
                ? cn("border-[3px] shadow-pop", tone.border, tone.tint)
                : cn("border-border bg-surface", !allSelected && "opacity-60"),
            )}
            aria-pressed={solo}
            aria-label={t("showOnly", { name: m.name })}
          >
            <MemberAvatar
              name={m.name}
              color={m.color}
              emoji={m.emoji}
              className="size-11 border-0"
            />
            <span className="hidden text-ink sm:inline">{m.name}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
