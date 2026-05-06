"use client";

import { Pin, Trash2, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/shared/dialog";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { MemberColorSwatch } from "@/components/shared/member-color-swatch";
import { MEMBER_COLORS, cn, isMemberColor, type MemberColor } from "@/lib/utils";
import type { Note, NoteCreateInput, NoteMember, NotePatchInput } from "./types";

type NoteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: NoteMember[];
  note: Note | null;
  onCreate: (input: NoteCreateInput) => Promise<void>;
  onUpdate: (id: string, patch: NotePatchInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

type FormState = {
  body: string;
  color: MemberColor;
  authorMemberId: string;
  pinned: boolean;
};

const NONE_AUTHOR = "";

function makeState(note: Note | null): FormState {
  if (note) {
    return {
      body: note.body,
      color: isMemberColor(note.color) ? note.color : "sun",
      authorMemberId: note.authorMemberId ?? NONE_AUTHOR,
      pinned: note.pinned,
    };
  }
  return {
    body: "",
    color: "sun",
    authorMemberId: NONE_AUTHOR,
    pinned: false,
  };
}

export function NoteDialog({
  open,
  onOpenChange,
  members,
  note,
  onCreate,
  onUpdate,
  onDelete,
}: NoteDialogProps) {
  const [state, setState] = useState<FormState>(() => makeState(note));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setState(makeState(note));
      setError(null);
    }
  }, [open, note]);

  const isEdit = Boolean(note);

  function patch(p: Partial<FormState>) {
    setState((prev) => ({ ...prev, ...p }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!state.body.trim()) {
      setError("Write something first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        body: state.body.trim(),
        color: state.color,
        authorMemberId:
          state.authorMemberId === NONE_AUTHOR ? null : state.authorMemberId,
        pinned: state.pinned,
      };
      if (note) {
        await onUpdate(note.id, payload);
      } else {
        await onCreate(payload);
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!note) return;
    if (!window.confirm("Delete this note?")) return;
    setSubmitting(true);
    setError(null);
    try {
      await onDelete(note.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-3 pr-10">
            <DialogTitle>{isEdit ? "Edit note" : "New note"}</DialogTitle>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="note-body"
              className="text-xs font-semibold uppercase tracking-wider text-muted"
            >
              Note
            </label>
            <textarea
              id="note-body"
              value={state.body}
              onChange={(e) => patch({ body: e.target.value })}
              placeholder="Write a quick note for the family…"
              autoFocus
              rows={6}
              className={cn(
                "w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base text-ink",
                "placeholder:text-muted resize-none",
                "focus:outline-none focus:ring-2 focus:ring-ink/20",
              )}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              Color
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
              Author
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => patch({ authorMemberId: NONE_AUTHOR })}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full pl-2 pr-4 py-1 tap-target border transition-colors",
                  state.authorMemberId === NONE_AUTHOR
                    ? "border-ink bg-surface shadow-soft"
                    : "border-border bg-surface/50 opacity-70 hover:opacity-100",
                )}
                aria-pressed={state.authorMemberId === NONE_AUTHOR}
              >
                <span className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-bg text-ink">
                  <Users className="size-4" />
                </span>
                <span className="text-sm text-ink">No author</span>
              </button>
              {members.map((m) => {
                const selected = m.id === state.authorMemberId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => patch({ authorMemberId: m.id })}
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

          <button
            type="button"
            onClick={() => patch({ pinned: !state.pinned })}
            aria-pressed={state.pinned}
            className={cn(
              "flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition-colors tap-target",
              state.pinned
                ? "border-ink bg-bg text-ink"
                : "border-border bg-surface text-muted hover:text-ink",
            )}
          >
            <Pin
              className={cn("size-4", state.pinned && "fill-current")}
            />
            {state.pinned ? "Pinned" : "Pin to top"}
          </button>

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
                  Delete
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
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
