"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/shared/dialog";
import { Input } from "@/components/shared/input";
import { MemberColorSwatch } from "@/components/shared/member-color-swatch";
import { InlineKeyboardPanel } from "@/components/setup/inline-keyboard-panel";
import { MEMBER_EMOJIS } from "@/components/setup/types";
import { MEMBER_COLORS, cn, isMemberColor, type MemberColor } from "@/lib/utils";
import type { CalendarMember } from "@/components/calendar/types";

type MemberPatch = {
  name?: string;
  color?: string;
  emoji?: string | null;
  role?: string;
};

type MemberCreateInput = {
  name: string;
  color: MemberColor;
  emoji?: string | null;
  role?: string;
};

type MemberEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Member being edited. `null` puts the dialog into create-mode: title +
   * primary button copy change, delete button is hidden, submission calls
   * `onCreate` instead of `onSave`.
   */
  member: CalendarMember | null;
  onSave: (id: string, patch: MemberPatch) => Promise<void>;
  onCreate: (input: MemberCreateInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

type FormState = {
  name: string;
  color: MemberColor;
  emoji: string;
  role: string;
};

function makeState(member: CalendarMember | null): FormState {
  if (!member) {
    return { name: "", color: "sand", emoji: "🧑", role: "MEMBER" };
  }
  return {
    name: member.name,
    color: isMemberColor(member.color) ? member.color : "sand",
    emoji: member.emoji ?? "🧑",
    role: member.role,
  };
}

export function MemberEditorDialog({
  open,
  onOpenChange,
  member,
  onSave,
  onCreate,
  onDelete,
}: MemberEditorDialogProps) {
  const t = useTranslations("setup.members");
  const tSettings = useTranslations("settings");
  const tCommon = useTranslations("common");
  const isCreate = member === null;
  const [state, setState] = useState<FormState>(() => makeState(member));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameFocused, setNameFocused] = useState(false);

  useEffect(() => {
    if (open) {
      setState(makeState(member));
      setError(null);
    }
  }, [open, member]);

  function patch(p: Partial<FormState>) {
    setState((prev) => ({ ...prev, ...p }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!state.name.trim()) {
      setError(tCommon("error"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (member) {
        await onSave(member.id, {
          name: state.name.trim(),
          color: state.color,
          emoji: state.emoji,
          role: state.role,
        });
      } else {
        await onCreate({
          name: state.name.trim(),
          color: state.color,
          emoji: state.emoji,
          role: state.role,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!member) return;
    if (
      !window.confirm(
        `${tCommon("areYouSure")}`,
      )
    )
      return;
    setSubmitting(true);
    setError(null);
    try {
      await onDelete(member.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-3 pr-10">
            <DialogTitle>
              {isCreate ? tSettings("members.addMember") : tCommon("edit")}
            </DialogTitle>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              {tCommon("member")}
            </label>
            <Input
              value={state.name}
              onChange={(e) => patch({ name: e.target.value })}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              required
              autoFocus
              maxLength={40}
            />
            <InlineKeyboardPanel
              open={nameFocused}
              value={state.name}
              onChange={(name) => patch({ name })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t("emoji")}
            </label>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
              {MEMBER_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => patch({ emoji })}
                  className={cn(
                    "size-12 tap-target rounded-2xl flex items-center justify-center text-2xl transition-[background-color,box-shadow,color,transform] ease-snappy",
                    state.emoji === emoji
                      ? "bg-bg ring-2 ring-ink"
                      : "bg-bg/60 hover:bg-bg",
                  )}
                  aria-pressed={state.emoji === emoji}
                  aria-label={`Emoji ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t("color")}
            </label>
            <div className="flex flex-wrap gap-2">
              {MEMBER_COLORS.map((c) => (
                <MemberColorSwatch
                  key={c}
                  color={c}
                  selected={state.color === c}
                  onClick={() => patch({ color: c })}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              {tCommon("admin")}
            </label>
            <div className="flex gap-2">
              {(["ADMIN", "MEMBER"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => patch({ role: r })}
                  aria-pressed={state.role === r}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm tap-target transition-colors border",
                    state.role === r
                      ? "border-ink bg-ink text-bg"
                      : "border-border bg-surface text-ink hover:bg-bg",
                  )}
                >
                  {r === "ADMIN" ? tCommon("admin") : tCommon("member")}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-accent-rose">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            {isCreate ? (
              <span />
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                disabled={submitting}
                className="text-accent-rose hover:bg-accent-rose/10"
              >
                <Trash2 className="size-4" />
                {tCommon("delete")}
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? tCommon("saving")
                  : isCreate
                    ? tSettings("members.addMember")
                    : tCommon("save")}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
