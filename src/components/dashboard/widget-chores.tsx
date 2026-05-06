"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { GlassCard } from "@/components/shared/glass-card";
import { MemberAvatar } from "@/components/shared/member-avatar";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/shared/dialog";
import { cn, isMemberColor, type MemberColor } from "@/lib/utils";
import type {
  Chore,
  ChoreCompletionResponse,
  ChoresPayload,
} from "@/components/chores/types";
import { TINT_BG } from "@/components/chores/types";
import { WidgetHeader } from "./widget-header";

type WidgetMember = {
  id: string;
  name: string;
  color: string;
  emoji?: string | null;
};

type WidgetChoresProps = {
  className?: string;
  members: WidgetMember[];
};

async function fetchChores(): Promise<ChoresPayload> {
  const res = await fetch("/api/chores", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load chores (${res.status})`);
  }
  return (await res.json()) as ChoresPayload;
}

export function WidgetChores({ className, members }: WidgetChoresProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["chores"],
    queryFn: fetchChores,
  });

  const [picker, setPicker] = useState<{ open: boolean; memberId: string | null }>(
    { open: false, memberId: null },
  );

  const chores = data?.chores ?? [];
  const weeklyByMember = data?.weeklyByMember ?? {};

  const totalWeekly = useMemo(
    () =>
      Object.values(weeklyByMember).reduce(
        (sum, m) => sum + (m?.points ?? 0),
        0,
      ),
    [weeklyByMember],
  );

  const choresByMember = useMemo(() => {
    const map = new Map<string, Chore[]>();
    for (const m of members) map.set(m.id, []);
    const unassigned: Chore[] = [];
    for (const c of chores) {
      if (c.memberId && map.has(c.memberId)) {
        map.get(c.memberId)!.push(c);
      } else {
        unassigned.push(c);
      }
    }
    return { byMember: map, unassigned };
  }, [chores, members]);

  const targetByMember = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of members) {
      const list = choresByMember.byMember.get(m.id) ?? [];
      const total = list.reduce((s, c) => s + c.points, 0);
      map.set(m.id, total);
    }
    return map;
  }, [choresByMember, members]);

  const completeMutation = useMutation({
    mutationFn: async (args: { chore: Chore; memberId: string }) => {
      const res = await fetch(`/api/chores/${args.chore.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: args.memberId }),
      });
      if (!res.ok) {
        throw new Error(`Failed (${res.status})`);
      }
      return (await res.json()) as ChoreCompletionResponse;
    },
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: ["chores"] });
      const prev = queryClient.getQueryData<ChoresPayload>(["chores"]);
      if (prev) {
        queryClient.setQueryData<ChoresPayload>(["chores"], {
          ...prev,
          weeklyByMember: {
            ...prev.weeklyByMember,
            [args.memberId]: {
              points:
                (prev.weeklyByMember[args.memberId]?.points ?? 0) +
                args.chore.points,
              completions:
                (prev.weeklyByMember[args.memberId]?.completions ?? 0) + 1,
            },
          },
        });
      }
      return { prev };
    },
    onError: (_err, _args, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["chores"], ctx.prev);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["chores"] });
    },
  });

  function openPickerFor(memberId: string | null) {
    setPicker({ open: true, memberId });
  }

  function pickChore(chore: Chore, memberId: string) {
    completeMutation.mutate({ chore, memberId });
    setPicker({ open: false, memberId: null });
  }

  const pickerChores: Chore[] = useMemo(() => {
    if (picker.memberId === null) return chores;
    const personal = choresByMember.byMember.get(picker.memberId) ?? [];
    return [...personal, ...choresByMember.unassigned];
  }, [picker.memberId, choresByMember, chores]);

  return (
    <GlassCard className={cn("p-6 flex flex-col gap-4", className)}>
      <WidgetHeader
        title="Chores"
        action={
          <span className="tabular text-xs font-medium text-muted">
            <Star
              className="mr-1 inline size-3 fill-current text-accent-sun align-text-bottom"
              strokeWidth={0}
              aria-hidden
            />
            <span className="tabular">{isLoading ? "—" : totalWeekly}</span> this
            week
          </span>
        }
      />
      {error ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-accent-rose/40 px-4 py-8 text-center text-sm text-accent-rose">
          Could not load chores.
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          No chores yet — set them up in /chores.
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {members.map((m) => {
            const safe: MemberColor = isMemberColor(m.color) ? m.color : "sand";
            const earned = weeklyByMember[m.id]?.points ?? 0;
            const target = targetByMember.get(m.id) ?? 0;
            return (
              <li
                key={m.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2",
                  TINT_BG[safe],
                )}
              >
                <MemberAvatar
                  name={m.name}
                  color={m.color}
                  emoji={m.emoji ?? undefined}
                  className="size-9"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-ink">
                    {m.name}
                  </span>
                  <span className="tabular text-xs text-muted">
                    {earned}/{target} stars
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openPickerFor(m.id)}
                  className={cn(
                    "size-12 tap-target inline-flex items-center justify-center rounded-full",
                    "bg-surface text-ink shadow-soft transition-colors hover:bg-bg",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
                  )}
                  aria-label={`Mark a chore done for ${m.name}`}
                >
                  <CheckCircle2 className="size-5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <PickChoreDialog
        open={picker.open}
        onOpenChange={(o) =>
          setPicker((p) => (o ? p : { open: false, memberId: null }))
        }
        chores={pickerChores}
        onPick={(chore) => {
          if (picker.memberId) pickChore(chore, picker.memberId);
        }}
      />
    </GlassCard>
  );
}

type PickChoreDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chores: Chore[];
  onPick: (chore: Chore) => void;
};

function PickChoreDialog({
  open,
  onOpenChange,
  chores,
  onPick,
}: PickChoreDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="flex flex-col gap-4">
          <DialogTitle>Mark done</DialogTitle>
          {chores.length === 0 ? (
            <p className="text-sm text-muted">
              No chores to log yet. Add some in the Chores tab.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {chores.map((chore) => (
                <li key={chore.id}>
                  <button
                    type="button"
                    onClick={() => onPick(chore)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2 tap-target",
                      "text-left transition-colors hover:bg-bg",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
                    )}
                  >
                    <span
                      aria-hidden
                      className="inline-flex size-10 items-center justify-center rounded-2xl bg-bg text-xl"
                    >
                      {chore.icon ?? "✨"}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium text-ink">
                      {chore.title}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-sun/30 px-2 py-0.5 text-xs font-medium text-ink">
                      <Star
                        className="size-3 fill-current text-accent-sun"
                        strokeWidth={0}
                      />
                      <span className="tabular">{chore.points}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
