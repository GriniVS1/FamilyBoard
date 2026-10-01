"use client";

import { motion } from "framer-motion";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { AlertCircle, CalendarDays, Trash2 } from "lucide-react";
import {
  addDays,
  format,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
} from "date-fns";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { cn } from "@/lib/utils";
import { TodoCheck } from "./todo-check";
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

const POPOVER_ACTION =
  "inline-flex h-12 items-center rounded-full px-4 text-sm font-medium hover:bg-ink/5 focus-ring-kid";

export function TodoRow({
  todo,
  member,
  pending,
  onToggle,
  onDelete,
  onDueDateChange,
}: TodoRowProps) {
  const locale = useLocale();
  const tCommon = useTranslations("common");
  const t = useTranslations("todos");
  const [dateOpen, setDateOpen] = useState(false);

  function formatDuePill(iso: string): string {
    const d = parseISO(iso);
    if (isToday(d)) return tCommon("today");
    if (isTomorrow(d)) return tCommon("tomorrow");
    if (isYesterday(d)) return tCommon("yesterday");
    return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(d);
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
        "flex items-center gap-3 rounded-2xl border border-border px-3 py-1 sm:px-4",
        "transition-colors duration-kid",
        todo.done ? "bg-bg/60" : "bg-surface",
        pending && "opacity-60",
      )}
    >
      <TodoCheck
        done={todo.done}
        color={member?.color}
        label={t("markDone", { title: todo.title })}
        onClick={() => onToggle(todo)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <motion.span
          initial={false}
          animate={{ opacity: todo.done ? 0.6 : 1 }}
          transition={{ duration: 0.18 }}
          className={cn(
            "kid-body line-clamp-2 text-ink",
            todo.done && "line-through decoration-2",
          )}
        >
          {todo.title}
        </motion.span>
        <PopoverPrimitive.Root open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverPrimitive.Trigger asChild>
            <button
              type="button"
              aria-label={t("dueDate")}
              className="inline-flex min-h-12 min-w-12 w-fit items-center rounded-full focus-ring-kid"
            >
              {due ? (
                <span
                  className={cn(
                    "kid-label tabular inline-flex h-8 w-fit items-center gap-1.5 rounded-full px-3",
                    todo.done
                      ? "bg-bg text-muted"
                      : overdue
                        ? "bg-danger-tint text-danger-ink"
                        : "bg-accent-sky-tint text-accent-sky-ink",
                  )}
                >
                  {overdue && <AlertCircle className="size-4" aria-hidden />}
                  {due}
                </span>
              ) : (
                <span className="inline-flex h-8 items-center px-1 text-muted">
                  <CalendarDays className="size-5" aria-hidden />
                </span>
              )}
            </button>
          </PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              sideOffset={6}
              align="start"
              className={cn(
                "z-50 w-[280px] rounded-2xl border border-border bg-surface p-3 shadow-lift",
                "data-[state=open]:animate-fade-in",
              )}
            >
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {t("dueDate")}
                </label>
                <input
                  type="date"
                  value={todo.dueDate ? format(parseISO(todo.dueDate), "yyyy-MM-dd") : ""}
                  onChange={(e) => handlePick(e.target.value || null)}
                  className={cn(
                    "h-12 rounded-2xl border border-border bg-bg px-3 text-base text-ink",
                    "tabular focus:outline-none focus:ring-2 focus:ring-ink/20",
                  )}
                />
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => handlePick(todayIso())}
                    className={cn(POPOVER_ACTION, "text-ink")}
                  >
                    {tCommon("today")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePick(tomorrowIso())}
                    className={cn(POPOVER_ACTION, "text-ink")}
                  >
                    {tCommon("tomorrow")}
                  </button>
                  {todo.dueDate && (
                    <button
                      type="button"
                      onClick={() => handlePick(null)}
                      className={cn(POPOVER_ACTION, "text-muted")}
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
        aria-label={`${tCommon("delete")}: ${todo.title}`}
        className={cn(
          "tap-target inline-flex size-12 shrink-0 items-center justify-center rounded-full",
          "bg-danger-tint text-danger-ink transition-colors focus-ring-kid",
        )}
      >
        <Trash2 className="size-5" />
      </button>
    </li>
  );
}
