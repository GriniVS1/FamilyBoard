"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { Plus, StickyNote } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";
import { NoteCard } from "./note-card";
import { NoteDialog } from "./note-dialog";
import type {
  Note,
  NoteCreateInput,
  NoteMember,
  NotePatchInput,
} from "./types";

type NotesViewProps = {
  initialMembers: NoteMember[];
};

const QUERY_KEY: QueryKey = ["notes"];

async function fetchNotes(): Promise<Note[]> {
  const res = await fetch("/api/notes", { cache: "no-store" });
  if (!res.ok) {
    let message = `Failed to load notes (${res.status})`;
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      if (data?.error?.message) message = data.error.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await res.json()) as Note[];
}

async function jsonRequest<T>(
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

export function NotesView({ initialMembers }: NotesViewProps) {
  const t = useTranslations("notes");
  const queryClient = useQueryClient();
  const { data: notes = [], isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchNotes,
    refetchInterval: 60_000, // kiosk never refocuses — poll for remote changes
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const membersById = useMemo(() => {
    const map = new Map<string, NoteMember>();
    for (const m of initialMembers) map.set(m.id, m);
    return map;
  }, [initialMembers]);

  const { pinned, others } = useMemo(() => {
    const p: Note[] = [];
    const o: Note[] = [];
    for (const n of notes) {
      if (n.pinned) p.push(n);
      else o.push(n);
    }
    const sortDesc = (a: Note, b: Note) =>
      new Date(b.updatedAt ?? b.createdAt).getTime() -
      new Date(a.updatedAt ?? a.createdAt).getTime();
    p.sort(sortDesc);
    o.sort(sortDesc);
    return { pinned: p, others: o };
  }, [notes]);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }

  const createMutation = useMutation({
    mutationFn: (input: NoteCreateInput) =>
      jsonRequest<Note>("/api/notes", "POST", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : t("dialog.couldNotSave"));
    },
  });

  const patchMutation = useMutation({
    mutationFn: (args: { id: string; patch: NotePatchInput }) =>
      jsonRequest<Note>(`/api/notes/${args.id}`, "PATCH", args.patch),
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<Note[]>(QUERY_KEY) ?? [];
      queryClient.setQueryData<Note[]>(
        QUERY_KEY,
        previous.map((n) =>
          n.id === args.id
            ? { ...n, ...args.patch, updatedAt: new Date().toISOString() }
            : n,
        ),
      );
      return { previous };
    },
    onError: (err, _args, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(QUERY_KEY, ctx.previous);
      showToast(err instanceof Error ? err.message : t("dialog.couldNotSave"));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      jsonRequest<{ ok: true }>(`/api/notes/${id}`, "DELETE"),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<Note[]>(QUERY_KEY) ?? [];
      queryClient.setQueryData<Note[]>(
        QUERY_KEY,
        previous.filter((n) => n.id !== id),
      );
      return { previous };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(QUERY_KEY, ctx.previous);
      showToast(err instanceof Error ? err.message : t("dialog.couldNotDelete"));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(note: Note) {
    setEditing(note);
    setDialogOpen(true);
  }
  function handleDelete(note: Note) {
    if (!window.confirm(t("deleteConfirm"))) return;
    deleteMutation.mutate(note.id);
  }
  function handleTogglePin(note: Note) {
    patchMutation.mutate({ id: note.id, patch: { pinned: !note.pinned } });
  }

  const isEmpty = !isLoading && notes.length === 0 && !error;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl tracking-tight text-ink sm:text-3xl">
          {t("title")}
        </h2>
        <Button onClick={openNew}>
          <Plus className="size-5" />
          {t("addNote")}
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
        <EmptyState onCreate={openNew} />
      ) : (
        <div className="flex flex-col gap-6">
          {pinned.length > 0 && (
            <section aria-label={t("pinned")} className="flex flex-col gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                {t("pinned")}
              </h3>
              <div className="columns-1 gap-4 md:columns-2 xl:columns-3">
                {pinned.map((n) => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    author={
                      n.authorMemberId
                        ? membersById.get(n.authorMemberId) ?? null
                        : null
                    }
                    onSelect={openEdit}
                    onTogglePin={handleTogglePin}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )}
          {others.length > 0 && (
            <section aria-label={t("title")} className="flex flex-col gap-2">
              {pinned.length > 0 && (
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {t("allNotes")}
                </h3>
              )}
              <div className="columns-1 gap-4 md:columns-2 xl:columns-3">
                {others.map((n) => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    author={
                      n.authorMemberId
                        ? membersById.get(n.authorMemberId) ?? null
                        : null
                    }
                    onSelect={openEdit}
                    onTogglePin={handleTogglePin}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <NoteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        members={initialMembers}
        note={editing}
        onCreate={async (input) => {
          await createMutation.mutateAsync(input);
        }}
        onUpdate={async (id, patch) => {
          await patchMutation.mutateAsync({ id, patch });
        }}
        onDelete={async (id) => {
          await deleteMutation.mutateAsync(id);
        }}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-2xl border border-accent-rose/40 bg-surface px-4 py-3 text-sm text-ink shadow-lift md:bottom-8"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations("notes");

  return (
    <GlassCard className="mx-auto flex w-full max-w-md flex-col items-center gap-4 p-10 text-center">
      <span
        className="inline-flex size-20 items-center justify-center rounded-full bg-accent-sun/30 text-ink"
        aria-hidden
      >
        <StickyNote className="size-9" />
      </span>
      <h3 className="font-display text-2xl tracking-tight text-ink">
        {t("empty")}
      </h3>
      <p className="text-sm text-muted">
        {t("emptyDesc")}
      </p>
      <Button onClick={onCreate}>
        <Plus className="size-5" />
        {t("writeFirst")}
      </Button>
    </GlassCard>
  );
}
