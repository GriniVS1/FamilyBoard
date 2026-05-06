"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { Plus, Sparkles, Star, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/shared/dialog";
import { GlassCard } from "@/components/shared/glass-card";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { cn, isMemberColor, type MemberColor } from "@/lib/utils";
import { ChoreDialog } from "./chore-dialog";
import { ChoreRow } from "./chore-row";
import { StarBurst, useStarBurst } from "./star-burst";
import { TINT_BG, TINT_BG_STRONG } from "./types";
import type {
  Chore,
  ChoreCompletionResponse,
  ChoreInput,
  ChoreMember,
  ChoresPayload,
} from "./types";
import { WeeklyProgressBar } from "./weekly-progress-bar";

type ChoresViewProps = {
  initialMembers: ChoreMember[];
};

const QUERY_KEY: QueryKey = ["chores"];

async function fetchChores(): Promise<ChoresPayload> {
  const res = await fetch("/api/chores", { cache: "no-store" });
  if (!res.ok) {
    let message = `Failed to load chores (${res.status})`;
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      if (data?.error?.message) message = data.error.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await res.json()) as ChoresPayload;
}

async function postJsonRequest<T>(
  url: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      if (data?.error?.message) message = data.error.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

type DialogState = {
  open: boolean;
  chore: Chore | null;
  initial?: { memberId?: string | null };
};

type PickerState = {
  open: boolean;
  chore: Chore | null;
  x: number;
  y: number;
};

type Toast = { id: number; message: string };

export function ChoresView({ initialMembers }: ChoresViewProps) {
  const t = useTranslations("chores");
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchChores,
  });

  const [dialog, setDialog] = useState<DialogState>({ open: false, chore: null });
  const [picker, setPicker] = useState<PickerState>({
    open: false,
    chore: null,
    x: 0,
    y: 0,
  });
  const [toast, setToast] = useState<Toast | null>(null);
  const [pendingChoreId, setPendingChoreId] = useState<string | null>(null);

  const { burst, trigger: triggerBurst, dismiss: dismissBurst } = useStarBurst();

  const chores = data?.chores ?? [];
  const weeklyByMember = data?.weeklyByMember ?? {};
  const weeklyByChore = data?.weeklyByChore ?? {};

  const totalWeekly = useMemo(() => {
    return Object.values(weeklyByMember).reduce(
      (sum, m) => sum + (m?.points ?? 0),
      0,
    );
  }, [weeklyByMember]);

  const choresByMember = useMemo(() => {
    const map = new Map<string, Chore[]>();
    for (const m of initialMembers) map.set(m.id, []);
    const unassigned: Chore[] = [];
    for (const c of chores) {
      if (c.memberId && map.has(c.memberId)) {
        map.get(c.memberId)!.push(c);
      } else {
        unassigned.push(c);
      }
    }
    return { byMember: map, unassigned };
  }, [chores, initialMembers]);

  const targetByMember = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of initialMembers) {
      const list = choresByMember.byMember.get(m.id) ?? [];
      const total = list.reduce((s, c) => s + c.points, 0);
      map.set(m.id, total);
    }
    return map;
  }, [choresByMember, initialMembers]);

  function showToast(message: string) {
    const id = Date.now();
    setToast({ id, message });
    window.setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 3000);
  }

  const saveMutation = useMutation({
    mutationFn: async (args: { input: ChoreInput; choreId: string | null }) => {
      const url = args.choreId ? `/api/chores/${args.choreId}` : "/api/chores";
      const method = args.choreId ? "PATCH" : "POST";
      return postJsonRequest<Chore>(url, method, args.input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (choreId: string) => {
      return postJsonRequest<{ ok: true }>(
        `/api/chores/${choreId}`,
        "DELETE",
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  type CompleteArgs = { chore: Chore; memberId: string };

  const completeMutation = useMutation({
    mutationFn: async (args: CompleteArgs) => {
      return postJsonRequest<ChoreCompletionResponse>(
        `/api/chores/${args.chore.id}/complete`,
        "POST",
        { memberId: args.memberId },
      );
    },
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<ChoresPayload>(QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<ChoresPayload>(QUERY_KEY, {
          ...previous,
          weeklyByMember: {
            ...previous.weeklyByMember,
            [args.memberId]: {
              points:
                (previous.weeklyByMember[args.memberId]?.points ?? 0) +
                args.chore.points,
              completions:
                (previous.weeklyByMember[args.memberId]?.completions ?? 0) + 1,
            },
          },
          weeklyByChore: {
            ...previous.weeklyByChore,
            [args.chore.id]: {
              points:
                (previous.weeklyByChore[args.chore.id]?.points ?? 0) +
                args.chore.points,
              completions:
                (previous.weeklyByChore[args.chore.id]?.completions ?? 0) + 1,
            },
          },
        });
      }
      setPendingChoreId(args.chore.id);
      return { previous };
    },
    onError: (err, _args, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
      showToast(err instanceof Error ? err.message : t("couldNotLog"));
    },
    onSettled: () => {
      setPendingChoreId(null);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  function handleComplete(chore: Chore, x: number, y: number) {
    if (chore.memberId) {
      triggerBurst(x, y);
      completeMutation.mutate({ chore, memberId: chore.memberId });
      return;
    }
    setPicker({ open: true, chore, x, y });
  }

  function pickMemberForUnassigned(memberId: string) {
    const target = picker.chore;
    if (!target) return;
    triggerBurst(picker.x, picker.y);
    completeMutation.mutate({ chore: target, memberId });
    setPicker({ open: false, chore: null, x: 0, y: 0 });
  }

  function openCreate(memberId: string | null) {
    setDialog({ open: true, chore: null, initial: { memberId } });
  }

  function openEdit(chore: Chore) {
    setDialog({ open: true, chore });
  }

  const isEmpty = !isLoading && chores.length === 0 && !error;
  const totalLabel = isLoading ? "—" : totalWeekly;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl sm:text-3xl tracking-tight text-ink">
            {t("title")}
          </h2>
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-accent-sun/30 px-3 py-1 text-sm font-medium text-ink"
            aria-label={`${totalWeekly} ${t("stars")}`}
          >
            <Star className="size-4 fill-current text-accent-sun" strokeWidth={0} />
            <span className="tabular">{totalLabel}</span>
            <span className="text-muted">{t("thisWeek")}</span>
          </span>
        </div>
        <Button onClick={() => openCreate(null)}>
          <Plus className="size-5" />
          <span>{t("addChore")}</span>
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-accent-rose/40 bg-accent-rose/10 px-4 py-3 text-sm text-ink"
        >
          {error instanceof Error ? error.message : t("couldNotLoad")}
        </div>
      )}

      {isEmpty ? (
        <EmptyState onCreate={() => openCreate(null)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {initialMembers.map((m) => {
            const list = choresByMember.byMember.get(m.id) ?? [];
            const earned = weeklyByMember[m.id]?.points ?? 0;
            const target = targetByMember.get(m.id) ?? 0;
            return (
              <MemberSection
                key={m.id}
                member={m}
                chores={list}
                earned={earned}
                target={target}
                weeklyByChore={weeklyByChore}
                pendingChoreId={pendingChoreId}
                onComplete={handleComplete}
                onEdit={openEdit}
                onAdd={() => openCreate(m.id)}
              />
            );
          })}

          {choresByMember.unassigned.length > 0 && (
            <UnassignedSection
              chores={choresByMember.unassigned}
              weeklyByChore={weeklyByChore}
              pendingChoreId={pendingChoreId}
              onComplete={handleComplete}
              onEdit={openEdit}
              onAdd={() => openCreate(null)}
            />
          )}
        </div>
      )}

      <ChoreDialog
        open={dialog.open}
        onOpenChange={(o) =>
          setDialog((d) => ({ ...d, open: o, chore: o ? d.chore : null }))
        }
        members={initialMembers}
        chore={dialog.chore}
        initial={dialog.initial}
        onSave={async (input, choreId) => {
          await saveMutation.mutateAsync({ input, choreId });
        }}
        onDelete={async (choreId) => {
          await deleteMutation.mutateAsync(choreId);
        }}
      />

      <PickMemberDialog
        open={picker.open}
        onOpenChange={(o) =>
          setPicker((p) => (o ? p : { open: false, chore: null, x: 0, y: 0 }))
        }
        members={initialMembers}
        chore={picker.chore}
        onPick={pickMemberForUnassigned}
      />

      <StarBurst burst={burst} onDone={dismissBurst} />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-2xl border border-accent-rose/40 bg-surface px-4 py-3 text-sm text-ink shadow-lift md:bottom-8"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

type MemberSectionProps = {
  member: ChoreMember;
  chores: Chore[];
  earned: number;
  target: number;
  weeklyByChore: Record<string, { points: number; completions: number }>;
  pendingChoreId: string | null;
  onComplete: (chore: Chore, x: number, y: number) => void;
  onEdit: (chore: Chore) => void;
  onAdd: () => void;
};

function MemberSection({
  member,
  chores,
  earned,
  target,
  weeklyByChore,
  pendingChoreId,
  onComplete,
  onEdit,
  onAdd,
}: MemberSectionProps) {
  const t = useTranslations("chores");
  const safeColor: MemberColor = isMemberColor(member.color) ? member.color : "sand";

  return (
    <GlassCard className={cn("flex flex-col gap-4 p-5", TINT_BG[safeColor])}>
      <div className="flex items-center gap-3">
        <MemberAvatar
          name={member.name}
          color={member.color}
          emoji={member.emoji}
          className="size-12 border-0"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-display text-lg tracking-tight text-ink">
            {member.name}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-ink/70">
            <Star className="size-3 fill-current text-accent-sun" strokeWidth={0} />
            <span className="tabular">{earned}</span>
            <span>{t("thisWeek")}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className={cn(
            "size-12 tap-target inline-flex items-center justify-center rounded-full",
            "bg-surface text-ink shadow-soft transition-colors hover:bg-bg",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
          )}
          aria-label={t("addChoreFor", { name: member.name })}
        >
          <Plus className="size-5" />
        </button>
      </div>

      <WeeklyProgressBar earned={earned} target={target} color={member.color} />

      {chores.length === 0 ? (
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface/40 px-4 py-6 text-sm text-muted transition-colors hover:bg-surface/70"
        >
          <Plus className="size-4" />
          {t("addFirst")}
        </button>
      ) : (
        <ul className="flex flex-col gap-2">
          {chores.map((chore) => (
            <ChoreRow
              key={chore.id}
              chore={chore}
              weeklyCompletions={weeklyByChore[chore.id]?.completions ?? 0}
              color={member.color}
              pending={pendingChoreId === chore.id}
              onComplete={onComplete}
              onEdit={onEdit}
            />
          ))}
        </ul>
      )}
    </GlassCard>
  );
}

type UnassignedSectionProps = {
  chores: Chore[];
  weeklyByChore: Record<string, { points: number; completions: number }>;
  pendingChoreId: string | null;
  onComplete: (chore: Chore, x: number, y: number) => void;
  onEdit: (chore: Chore) => void;
  onAdd: () => void;
};

function UnassignedSection({
  chores,
  weeklyByChore,
  pendingChoreId,
  onComplete,
  onEdit,
  onAdd,
}: UnassignedSectionProps) {
  const t = useTranslations("chores");

  return (
    <GlassCard className={cn("flex flex-col gap-4 p-5 lg:col-span-2 xl:col-span-3", TINT_BG_STRONG.sand)}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="inline-flex size-12 items-center justify-center rounded-full border border-border bg-surface text-ink"
        >
          <Users className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-display text-lg tracking-tight text-ink">
            {t("anyone")}
          </span>
          <span className="text-xs text-ink/70">
            {t("anyoneSub")}
          </span>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className={cn(
            "size-12 tap-target inline-flex items-center justify-center rounded-full",
            "bg-surface text-ink shadow-soft transition-colors hover:bg-bg",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
          )}
          aria-label={t("addUnassigned")}
        >
          <Plus className="size-5" />
        </button>
      </div>

      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {chores.map((chore) => (
          <ChoreRow
            key={chore.id}
            chore={chore}
            weeklyCompletions={weeklyByChore[chore.id]?.completions ?? 0}
            color="sand"
            pending={pendingChoreId === chore.id}
            onComplete={onComplete}
            onEdit={onEdit}
          />
        ))}
      </ul>
    </GlassCard>
  );
}

type EmptyStateProps = {
  onCreate: () => void;
};

function EmptyState({ onCreate }: EmptyStateProps) {
  const t = useTranslations("chores");

  return (
    <GlassCard className="mx-auto flex w-full max-w-md flex-col items-center gap-4 p-10 text-center">
      <span
        className="inline-flex size-20 items-center justify-center rounded-full bg-accent-sun/30 text-ink"
        aria-hidden
      >
        <Sparkles className="size-9" />
      </span>
      <h3 className="font-display text-2xl tracking-tight text-ink">
        {t("emptyTitle")}
      </h3>
      <p className="text-sm text-muted">
        {t("emptyDesc")}
      </p>
      <Button onClick={onCreate}>
        <Plus className="size-5" />
        {t("createFirst")}
      </Button>
    </GlassCard>
  );
}

type PickMemberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: ChoreMember[];
  chore: Chore | null;
  onPick: (memberId: string) => void;
};

function PickMemberDialog({
  open,
  onOpenChange,
  members,
  chore,
  onPick,
}: PickMemberDialogProps) {
  const t = useTranslations("chores");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="flex flex-col gap-5">
          <DialogTitle>{t("whoDidIt")}</DialogTitle>
          {chore && (
            <p className="text-sm text-muted">
              {t("whoDidItDesc", { title: chore.title })}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onPick(m.id)}
                className={cn(
                  "flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-3 tap-target",
                  "text-left transition-colors hover:bg-bg",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
                )}
              >
                <MemberAvatar
                  name={m.name}
                  color={m.color}
                  emoji={m.emoji}
                  className="size-10 border-0"
                />
                <span className="truncate text-sm font-medium text-ink">
                  {m.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
