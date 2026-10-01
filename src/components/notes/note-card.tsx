"use client";

import { motion } from "framer-motion";
import { Pin, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { cn, isMemberColor, type MemberColor } from "@/lib/utils";
import type { Note, NoteMember } from "./types";
import { NOTE_TINT } from "./types";

type NoteCardProps = {
  note: Note;
  author: NoteMember | null;
  onSelect: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onDelete: (note: Note) => void;
};

export function NoteCard({
  note,
  author,
  onSelect,
  onTogglePin,
  onDelete,
}: NoteCardProps) {
  const t = useTranslations("notes");
  const tCommon = useTranslations("common");
  const safeColor: MemberColor = isMemberColor(note.color) ? note.color : "sun";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "relative mb-4 break-inside-avoid rounded-3xl border border-border p-4",
        "shadow-soft",
        NOTE_TINT[safeColor],
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(note)}
        className="block min-h-12 w-full rounded-2xl text-left focus-ring-kid"
        aria-label={tCommon("edit")}
      >
        <p className="kid-body whitespace-pre-wrap text-ink">
          {note.body || <span className="italic text-muted">{tCommon("none")}</span>}
        </p>
      </button>

      <div className="mt-3 flex items-center gap-2">
        {author && (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <MemberAvatar
              name={author.name}
              color={author.color}
              emoji={author.emoji}
              className="size-8 border-0"
            />
            <span className="kid-label truncate text-ink">{author.name}</span>
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => onTogglePin(note)}
            aria-label={note.pinned ? t("pinned") : t("pinToTop")}
            aria-pressed={note.pinned}
            className={cn(
              "inline-flex size-12 items-center justify-center rounded-full border-2 transition-colors duration-kid focus-ring-kid",
              note.pinned
                ? "border-ink bg-ink text-bg"
                : "border-ink/30 bg-surface/70 text-ink",
            )}
          >
            <Pin className={cn("size-5", note.pinned && "fill-current")} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(note)}
            aria-label={`${tCommon("delete")}: ${note.body.slice(0, 24)}`}
            className="inline-flex size-12 items-center justify-center rounded-full bg-danger-tint text-danger-ink transition-colors focus-ring-kid"
          >
            <Trash2 className="size-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
