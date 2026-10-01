"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Calendar as CalendarIcon, Check, Plus, Users } from "lucide-react";
import { format } from "date-fns";
import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/shared/input";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { InlineKeyboardPanel } from "@/components/setup/inline-keyboard-panel";
import { useOskField } from "@/hooks/use-osk-field";
import { cn } from "@/lib/utils";
import type { TodoCreateInput, TodoMember } from "./types";

type TodoInputProps = {
  members: TodoMember[];
  onSubmit: (input: TodoCreateInput) => Promise<void> | void;
};

function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function TodoInput({ members, onSubmit }: TodoInputProps) {
  const t = useTranslations("todos");
  const tCommon = useTranslations("common");
  const [title, setTitle] = useState("");
  const [memberId, setMemberId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { activeField, bind } = useOskField<"title">();

  // Deliberately no focus-on-mount: this input is always on the todos page,
  // and focusing it would pop the on-screen keyboard on every visit. The
  // re-focus after submit (below) is fine — the user is actively typing then.
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: trimmed,
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
    <div className="flex w-full flex-col gap-2">
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
          placeholder={t("addPlaceholder")}
          aria-label={t("addPlaceholder")}
          className="h-12 flex-1 border-0 bg-transparent px-3 text-base shadow-none sm:px-5 sm:text-lg"
          disabled={submitting}
          {...bind("title")}
        />

        <PopoverPrimitive.Root open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverPrimitive.Trigger asChild>
            <button
              type="button"
              aria-label={t("dueDate")}
              className={cn(
                "size-12 tap-target shrink-0 inline-flex items-center justify-center rounded-full",
                "transition-colors focus-ring-kid",
                dueDate
                  ? "bg-accent-sky-tint text-accent-sky-ink"
                  : "text-muted hover:bg-ink/5 hover:text-ink",
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
                  {t("dueDate")}
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
                    className="inline-flex h-12 items-center rounded-full px-4 text-sm font-medium text-ink hover:bg-ink/5 focus-ring-kid"
                  >
                    {tCommon("today")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDueDate(null);
                      setDateOpen(false);
                    }}
                    className="inline-flex h-12 items-center rounded-full px-4 text-sm font-medium text-muted hover:bg-ink/5 focus-ring-kid"
                  >
                    {t("clearDate")}
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
              aria-label={t("assignMember")}
              className={cn(
                "size-12 tap-target shrink-0 inline-flex items-center justify-center rounded-full",
                "transition-colors focus-ring-kid",
                selectedMember
                  ? ""
                  : "text-muted hover:bg-ink/5 hover:text-ink",
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
                      "flex min-h-12 w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-base focus-ring-kid-inset",
                      "hover:bg-ink/5",
                      memberId === null && "bg-ink/5",
                    )}
                  >
                    <span className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-bg text-ink">
                      <Users className="size-4" />
                    </span>
                    <span className="flex-1 text-ink">{tCommon("anyone")}</span>
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
                        "flex min-h-12 w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-base focus-ring-kid-inset",
                        "hover:bg-ink/5",
                        memberId === m.id && "bg-ink/5",
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
          aria-label={t("addPlaceholder")}
          className={cn(
            "size-12 tap-target shrink-0 inline-flex items-center justify-center rounded-full",
            "bg-accent-sky text-on-accent shadow-pop transition-opacity disabled:opacity-40 disabled:shadow-none",
            "focus-ring-kid active:shadow-press",
          )}
        >
          <Plus className="size-6" strokeWidth={2.75} />
        </button>
      </form>
      <InlineKeyboardPanel
        open={activeField === "title"}
        value={title}
        onChange={setTitle}
      />
    </div>
  );
}
