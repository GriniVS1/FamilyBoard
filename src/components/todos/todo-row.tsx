"use client";

import { motion } from "framer-motion";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CalendarDays, Check, Trash2 } from "lucide-react";
import {
  addDays,
  format,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
} from "date-fns";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { cn } from "@/lib/utils";
import type { Todo, TodoMember } from "./types";

type TodoRowProps = {
  todo: Todo;
  member: TodoMember | null;
  pending?: boolean;
  onToggle: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
  onDueDateChange: (todo: Todo, dueDate: string | null) => void;
};

function isOverdue(iso: string): boolean {
  const d = parseISO(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime() && !isToday(d);
}

function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function tomorrowIso(): string {
  return format(addDays(new Date(), 1), "yyyy-MM-dd");
}

export function TodoRow({
  todo,
  member,
  pending,
  onToggle,
  onDelete,
  onDueDateChange,
}: TodoRowProps) {
  const tCommon = useTranslations("common");
  const t = useTranslations("todos");
  const [dateOpen, setDateOpen] = useState(false);

  function formatDuePill(iso: string): string {
    const d = parseISO(iso);
    if (isToday(d)) return tCommon("today");
    if (isTomorrow(d)) return tCommon("tomorrow");
    if (isYesterday(d)) return tCommon("yesterday");
    return format(d, "MMM d");
  }

  const due = todo.dueDate ? formatDuePill(todo.dueDate) : null;
  const overdue = !todo.done && todo.dueDate ? isOverdue(todo.dueDate) : false;

  function handlePick(nextDueDate: string | null) {
    onDueDateChange(todo, nextDueDate);
    setDateOpen(false);
  }

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
        aria-label={t("markDone", { title: todo.title })}
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
            "truncate text-base text-ink",
            todo.done && "line-through decoration-2",
          )}
        >
          {todo.title}
        </motion.span>
        <PopoverPrimitive.Root open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverPrimitive.Trigger asChild>
            {due ? (
              <button
                type="button"
                aria-label={t("dueDate")}
                className={cn(
                  "relative inline-flex w-fit items-center",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 rounded-full",
                )}
              >
                <span aria-hidden className="absolute -inset-4 rounded-full" />
                <span
                  className={cn(
                    "tabular inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    "transition-colors",
                    todo.done
                      ? "bg-bg text-muted"
                      : overdue
                        ? "bg-accent-rose/30 text-ink hover:bg-accent-rose/40"
                        : "bg-accent-sky/30 text-ink hover:bg-accent-sky/40",
                  )}
                >
                  {due}
                </span>
              </button>
            ) : (
              <button
                type="button"
                aria-label={t("dueDate")}
                className={cn(
                  "relative inline-flex w-fit items-center text-muted transition-colors hover:text-ink",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 rounded-full",
                )}
              >
                <span aria-hidden className="absolute -inset-4 rounded-full" />
                <CalendarDays className="size-4" />
              </button>
            )}
          </PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              sideOffset={6}
              align="start"
              className={cn(
                "z-50 w-[260px] rounded-2xl border border-border bg-surface p-3 shadow-lift",
                "data-[state=open]:animate-fade-in",
              )}
            >
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {t("dueDate")}
                </label>
                <input
                  type="date"
                  value={todo.dueDate ?? ""}
                  onChange={(e) => handlePick(e.target.value || null)}
                  className={cn(
                    "h-12 rounded-2xl border border-border bg-bg px-3 text-base text-ink",
                    "tabular focus:outline-none focus:ring-2 focus:ring-ink/20",
                  )}
                />
                <div className="flex items-center justify-between gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => handlePick(todayIso())}
                    className="tap-target rounded-full px-3 py-1.5 text-xs text-ink hover:bg-bg"
                  >
                    {tCommon("today")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePick(tomorrowIso())}
                    className="tap-target rounded-full px-3 py-1.5 text-xs text-ink hover:bg-bg"
                  >
                    {tCommon("tomorrow")}
                  </button>
                  {todo.dueDate && (
                    <button
                      type="button"
                      onClick={() => handlePick(null)}
                      className="tap-target rounded-full px-3 py-1.5 text-xs text-muted hover:bg-bg"
                    >
                      {t("clearDate")}
                    </button>
                  )}
                </div>
              </div>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
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
        aria-label={`${tCommon("delete")} ${todo.title}`}
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
