"use client";

import { Trash2, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/shared/dialog";
import { Input } from "@/components/shared/input";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { InlineKeyboardPanel } from "@/components/setup/inline-keyboard-panel";
import { useOskField } from "@/hooks/use-osk-field";
import { cn } from "@/lib/utils";
import { CHORE_ICONS } from "./types";
import type { Chore, ChoreInput, ChoreMember } from "./types";

type ChoreDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: ChoreMember[];
  chore: Chore | null;
  initial?: { memberId?: string | null };
  onSave: (input: ChoreInput, choreId: string | null) => Promise<void>;
  onDelete: (choreId: string) => Promise<void>;
};

type FormState = {
  title: string;
  memberId: string; // "" === unassigned
  icon: string;
  points: number;
};

const ANYONE_VALUE = "";

function makeState(chore: Chore | null, initial?: ChoreDialogProps["initial"]): FormState {
  if (chore) {
    return {
      title: chore.title,
      memberId: chore.memberId ?? ANYONE_VALUE,
      icon: chore.icon ?? "",
      points: chore.points,
    };
  }
  return {
    title: "",
    memberId: initial?.memberId ?? ANYONE_VALUE,
    icon: "",
    points: 1,
  };
}

export function ChoreDialog({
  open,
  onOpenChange,
  members,
  chore,
  initial,
  onSave,
  onDelete,
}: ChoreDialogProps) {
  const t = useTranslations("chores.dialog");
  const tCommon = useTranslations("common");
  const [state, setState] = useState<FormState>(() => makeState(chore, initial));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { activeField, bind, close: closeKeyboard } = useOskField<"title">();

  useEffect(() => {
    if (open) {
      setState(makeState(chore, initial));
      setError(null);
    } else {
      closeKeyboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chore?.id, initial?.memberId]);

  const isEdit = Boolean(chore);

  function patch(p: Partial<FormState>) {
    setState((prev) => ({ ...prev, ...p }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!state.title.trim()) {
      setError(t("titleRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const input: ChoreInput = {
        memberId: state.memberId === ANYONE_VALUE ? null : state.memberId,
        title: state.title.trim(),
        icon: state.icon || null,
        points: Math.max(1, Math.min(10, Math.round(state.points))),
        rrule: null,
      };
      await onSave(input, chore?.id ?? null);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("couldNotSave"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!chore) return;
    if (!window.confirm(t("deleteConfirm"))) return;
    setSubmitting(true);
    setError(null);
    try {
      await onDelete(chore.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("couldNotDelete"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-3 pr-10">
            <DialogTitle>{isEdit ? t("editTitle") : t("newTitle")}</DialogTitle>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t("name")}
            </label>
            <Input
              value={state.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="e.g. Empty the dishwasher"
              required
              autoFocus
              {...bind("title")}
            />
            <InlineKeyboardPanel
              open={activeField === "title"}
              value={state.title}
              onChange={(title) => patch({ title })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t("member")}
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => patch({ memberId: ANYONE_VALUE })}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full pl-2 pr-4 py-1 tap-target border transition-colors",
                  state.memberId === ANYONE_VALUE
                    ? "border-ink bg-surface shadow-soft"
                    : "border-border bg-surface/50 opacity-70 hover:opacity-100",
                )}
                aria-pressed={state.memberId === ANYONE_VALUE}
              >
                <span className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-bg text-ink">
                  <Users className="size-4" />
                </span>
                <span className="text-sm text-ink">{tCommon("anyone")}</span>
              </button>
              {members.map((m) => {
                const selected = m.id === state.memberId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => patch({ memberId: m.id })}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full pl-1 pr-3 py-1 tap-target border transition-colors",
                      selected
                        ? "border-ink bg-surface shadow-soft"
                        : "border-border bg-surface/50 opacity-70 hover:opacity-100",
                    )}
                    aria-pressed={selected}
                  >
                    <MemberAvatar
                      name={m.name}
                      color={m.color}
                      emoji={m.emoji}
                      className="size-9 border-0"
                    />
                    <span className="text-sm text-ink">{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t("iconLabel")}
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => patch({ icon: "" })}
                className={cn(
                  "size-12 tap-target rounded-2xl flex items-center justify-center text-sm transition-[background-color,box-shadow,color,transform] ease-snappy",
                  state.icon === ""
                    ? "bg-bg ring-2 ring-ink"
                    : "bg-bg/60 hover:bg-bg text-muted",
                )}
                aria-pressed={state.icon === ""}
                aria-label={t("noIcon")}
              >
                {t("noIcon")}
              </button>
              {CHORE_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => patch({ icon: emoji })}
                  className={cn(
                    "size-12 tap-target rounded-2xl flex items-center justify-center text-2xl transition-[background-color,box-shadow,color,transform] ease-snappy",
                    state.icon === emoji
                      ? "bg-bg ring-2 ring-ink"
                      : "bg-bg/60 hover:bg-bg",
                  )}
                  aria-pressed={state.icon === emoji}
                  aria-label={`Icon ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="chore-points"
              className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted"
            >
              <span>{t("points")}</span>
              <span className="tabular text-ink">⭐ {state.points}</span>
            </label>
            <input
              id="chore-points"
              type="range"
              min={1}
              max={10}
              step={1}
              value={state.points}
              onChange={(e) => patch({ points: Number(e.target.value) })}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-bg accent-ink"
            />
            <div className="flex justify-between text-[10px] tabular text-muted">
              <span>1</span>
              <span>10</span>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-accent-rose">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <div>
              {isEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={submitting}
                  className="text-accent-rose hover:bg-accent-rose/10"
                >
                  <Trash2 className="size-4" />
                  {t("delete")}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? tCommon("saving") : t("save")}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
