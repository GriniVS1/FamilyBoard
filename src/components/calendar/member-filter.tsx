"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { cn } from "@/lib/utils";
import type { CalendarMember } from "./types";

type MemberFilterProps = {
  members: CalendarMember[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export function MemberFilter({ members, selectedIds, onChange }: MemberFilterProps) {
  const t = useTranslations("calendar");
  const allSelected = selectedIds.length === members.length;

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      const next = selectedIds.filter((x) => x !== id);
      onChange(next.length === 0 ? members.map((m) => m.id) : next);
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function selectAll() {
    onChange(members.map((m) => m.id));
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={selectAll}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-4 py-2 tap-target",
          "border transition-colors text-sm font-medium",
          allSelected
            ? "bg-ink text-bg border-ink"
            : "bg-surface text-ink border-border hover:bg-bg",
        )}
        aria-pressed={allSelected}
      >
        <Users className="size-4" />
        {t("members")}
      </motion.button>
      {members.map((m) => {
        const selected = selectedIds.includes(m.id);
        return (
          <motion.button
            key={m.id}
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => toggle(m.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full pl-1 pr-4 py-1 tap-target",
              "border transition-colors text-sm font-medium",
              selected
                ? "border-ink shadow-soft bg-surface"
                : "border-border bg-surface/50 opacity-60 hover:opacity-100",
            )}
            aria-pressed={selected}
            aria-label={`Filter ${m.name}`}
          >
            <MemberAvatar
              name={m.name}
              color={m.color}
              emoji={m.emoji}
              className="size-9 border-0"
            />
            <span className="text-ink">{m.name}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
