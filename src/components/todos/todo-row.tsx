"use client";

import { motion } from "framer-motion";
import { Check, Trash2 } from "lucide-react";
import { format, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { cn } from "@/lib/utils";
import type { Todo, TodoMember } from "./types";

type TodoRowProps = {
  todo: Todo;
  member: TodoMember | null;
  pending?: boolean;
  onToggle: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
};

function formatDuePill(iso: string): string {
  const d = parseISO(iso);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
}

function isOverdue(iso: string): boolean {
  const d = parseISO(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime() && !isToday(d);
}

export function TodoRow({ todo, member, pending, onToggle, onDelete }: TodoRowProps) {
  const due = todo.dueDate ? formatDuePill(todo.dueDate) : null;
  const overdue = !todo.done && todo.dueDate ? isOverdue(todo.dueDate) : false;

  return (
    <li
      className={cn(
        "group flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2 sm:px-4 sm:py-2.5",
        "transition-colors hover:bg-bg/40",
        pending && "opacity-60",
      )}
    >
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        transition={{ type: "spring", stiffness: 400, damping: 24 }}
        onClick={() => onToggle(todo)}
        aria-label={todo.done ? `Mark ${todo.title} not done` : `Mark ${todo.title} done`}
        aria-pressed={todo.done}
        className={cn(
          "size-12 tap-target shrink-0 inline-flex items-center justify-center rounded-full",
          "border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
          todo.done
            ? "border-ink bg-ink text-bg"
            : "border-border bg-surface text-transparent hover:border-ink/40",
        )}
      >
        <Check className="size-5" strokeWidth={3} />
      </motion.button>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <motion.span
          initial={false}
          animate={{
            opacity: todo.done ? 0.55 : 1,
          }}
          transition={{ duration: 0.18 }}
          className={cn(
            "truncate text-base text-ink transition-all",
            todo.done && "line-through decoration-2",
          )}
        >
          {todo.title}
        </motion.span>
        {due && (
          <span
            className={cn(
              "tabular inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              todo.done
                ? "bg-bg text-muted"
                : overdue
                  ? "bg-accent-rose/30 text-ink"
                  : "bg-accent-sky/30 text-ink",
            )}
          >
            {due}
          </span>
        )}
      </div>

      {member && (
        <MemberAvatar
          name={member.name}
          color={member.color}
          emoji={member.emoji}
          className="size-9 shrink-0 border-0"
        />
      )}

      <button
        type="button"
        onClick={() => onDelete(todo)}
        aria-label={`Delete ${todo.title}`}
        className={cn(
          "size-12 tap-target shrink-0 inline-flex items-center justify-center rounded-full text-muted",
          "opacity-0 transition-opacity hover:bg-accent-rose/10 hover:text-accent-rose",
          "group-hover:opacity-100 focus:opacity-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
        )}
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}
