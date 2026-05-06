"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Calendar as CalendarIcon, Check, Plus, Users } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Input } from "@/components/shared/input";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { cn } from "@/lib/utils";
import type { TodoCreateInput, TodoMember } from "./types";

type TodoInputProps = {
  members: TodoMember[];
  onSubmit: (input: TodoCreateInput) => Promise<void> | void;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TodoInput({ members, onSubmit }: TodoInputProps) {
  const [title, setTitle] = useState("");
  const [memberId, setMemberId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const t = title.trim();
    if (!t || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: t,
        memberId: memberId,
        dueDate: dueDate,
      });
      setTitle("");
      setMemberId(null);
      setDueDate(null);
    } finally {
      setSubmitting(false);
      inputRef.current?.focus();
    }
  }

  const selectedMember = memberId
    ? members.find((m) => m.id === memberId) ?? null
    : null;

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex w-full items-center gap-2 rounded-3xl border border-border bg-surface p-2",
        "shadow-soft",
      )}
    >
      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a to-do…"
        aria-label="New to-do title"
        className="flex-1 border-0 bg-transparent shadow-none focus:ring-0"
        disabled={submitting}
      />

      <PopoverPrimitive.Root open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label="Set due date"
            className={cn(
              "size-12 tap-target shrink-0 inline-flex items-center justify-center rounded-full",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
              dueDate
                ? "bg-accent-sky/30 text-ink"
                : "text-muted hover:bg-bg hover:text-ink",
            )}
          >
            <CalendarIcon className="size-5" />
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            sideOffset={6}
            align="end"
            className={cn(
              "z-50 w-[260px] rounded-2xl border border-border bg-surface p-3 shadow-lift",
              "data-[state=open]:animate-fade-in",
            )}
          >
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                Due date
              </label>
              <input
                type="date"
                value={dueDate ?? ""}
                onChange={(e) => setDueDate(e.target.value || null)}
                className={cn(
                  "h-12 rounded-2xl border border-border bg-bg px-3 text-base text-ink",
                  "tabular focus:outline-none focus:ring-2 focus:ring-ink/20",
                )}
              />
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setDueDate(todayIso());
                    setDateOpen(false);
                  }}
                  className="rounded-full px-3 py-1.5 text-xs text-ink hover:bg-bg"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDueDate(null);
                    setDateOpen(false);
                  }}
                  className="rounded-full px-3 py-1.5 text-xs text-muted hover:bg-bg"
                >
                  Clear
                </button>
              </div>
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>

      <PopoverPrimitive.Root open={memberOpen} onOpenChange={setMemberOpen}>
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label="Assign member"
            className={cn(
              "size-12 tap-target shrink-0 inline-flex items-center justify-center rounded-full",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
              selectedMember
                ? ""
                : "text-muted hover:bg-bg hover:text-ink",
            )}
          >
            {selectedMember ? (
              <MemberAvatar
                name={selectedMember.name}
                color={selectedMember.color}
                emoji={selectedMember.emoji}
                className="size-10 border-0"
              />
            ) : (
              <Users className="size-5" />
            )}
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            sideOffset={6}
            align="end"
            className={cn(
              "z-50 w-[240px] rounded-2xl border border-border bg-surface p-2 shadow-lift",
              "data-[state=open]:animate-fade-in",
            )}
          >
            <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setMemberId(null);
                    setMemberOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm",
                    "hover:bg-bg",
                    memberId === null && "bg-bg",
                  )}
                >
                  <span className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-bg text-ink">
                    <Users className="size-4" />
                  </span>
                  <span className="flex-1 text-ink">Anyone</span>
                  {memberId === null && <Check className="size-4 text-ink" />}
                </button>
              </li>
              {members.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setMemberId(m.id);
                      setMemberOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm",
                      "hover:bg-bg",
                      memberId === m.id && "bg-bg",
                    )}
                  >
                    <MemberAvatar
                      name={m.name}
                      color={m.color}
                      emoji={m.emoji}
                      className="size-9 border-0"
                    />
                    <span className="flex-1 truncate text-ink">{m.name}</span>
                    {memberId === m.id && <Check className="size-4 text-ink" />}
                  </button>
                </li>
              ))}
            </ul>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>

      <button
        type="submit"
        disabled={!title.trim() || submitting}
        aria-label="Add to-do"
        className={cn(
          "size-12 tap-target shrink-0 inline-flex items-center justify-center rounded-full",
          "bg-ink text-bg transition-opacity hover:opacity-90 disabled:opacity-40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30",
        )}
      >
        <Plus className="size-5" />
      </button>
    </form>
  );
}
