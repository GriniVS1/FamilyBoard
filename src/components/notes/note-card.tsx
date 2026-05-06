"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { motion } from "framer-motion";
import { MoreHorizontal, Pin, PinOff, Trash2 } from "lucide-react";
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
  const safeColor: MemberColor = isMemberColor(note.color) ? note.color : "sun";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "group relative mb-4 break-inside-avoid rounded-3xl border border-border p-4",
        "shadow-soft transition-shadow hover:shadow-lift",
        NOTE_TINT[safeColor],
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(note)}
        className={cn(
          "block w-full text-left tap-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 rounded-2xl",
        )}
        aria-label="Edit note"
      >
        <p className="whitespace-pre-wrap text-base leading-relaxed text-ink">
          {note.body || (
            <span className="italic text-muted">Empty note</span>
          )}
        </p>
      </button>

      <div className="mt-3 flex items-center gap-2">
        {author && (
          <span className="inline-flex items-center gap-1.5">
            <MemberAvatar
              name={author.name}
              color={author.color}
              emoji={author.emoji}
              className="size-7 border-0"
            />
            <span className="text-xs text-ink/70">{author.name}</span>
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin(note);
        }}
        aria-label={note.pinned ? "Unpin note" : "Pin note"}
        aria-pressed={note.pinned}
        className={cn(
          "absolute right-14 top-2 size-12 tap-target inline-flex items-center justify-center rounded-full",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
          note.pinned
            ? "text-ink"
            : "text-ink/40 opacity-0 hover:text-ink group-hover:opacity-100 focus:opacity-100",
        )}
      >
        {note.pinned ? (
          <Pin className="size-4 fill-current" />
        ) : (
          <Pin className="size-4" />
        )}
      </button>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Note actions"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "absolute right-2 top-2 size-12 tap-target inline-flex items-center justify-center rounded-full",
              "text-ink/60 opacity-0 transition-opacity hover:text-ink group-hover:opacity-100 focus:opacity-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
            )}
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className={cn(
              "z-50 min-w-[160px] rounded-2xl border border-border bg-surface p-1 shadow-lift",
              "data-[state=open]:animate-fade-in",
            )}
          >
            <DropdownMenu.Item
              onSelect={() => onTogglePin(note)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink outline-none",
                "data-[highlighted]:bg-bg",
              )}
            >
              {note.pinned ? (
                <>
                  <PinOff className="size-4" />
                  Unpin
                </>
              ) : (
                <>
                  <Pin className="size-4" />
                  Pin
                </>
              )}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => onDelete(note)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-accent-rose outline-none",
                "data-[highlighted]:bg-accent-rose/10",
              )}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </motion.div>
  );
}
