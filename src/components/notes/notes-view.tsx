"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { isMemberColor } from "@/lib/utils";
import { ConfirmDialog } from "@/components/kids/confirm-dialog";
import { KidToast } from "@/components/kids/kid-toast";
import { EmptyState, ErrorState, Skeleton } from "@/components/kids/state-views";
import { Button } from "@/components/shared/button";
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
    throw new Error(`notes ${res.status}`);
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
    throw new Error(`${method} ${res.status}`);
  }
  return (await res.json()) as T;
}

type Toast =
  | { kind: "error"; text: string }
  | { kind: "undo"; note: Note };

export function NotesView({ initialMembers }: NotesViewProps) {
  const t = useTranslations("notes");
  const queryClient = useQueryClient();
  const { data: notes = [], isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchNotes,
    refetchInterval: 60_000, // kiosk never refocuses — poll for remote changes
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);

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

  function showError(text: string) {
    setToast({ kind: "error", text });
  }

  const createMutation = useMutation({
    mutationFn: (input: NoteCreateInput) =>
      jsonRequest<Note>("/api/notes", "POST", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: () => {
      showError(t("dialog.couldNotSave"));
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
    onError: (_err, _args, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(QUERY_KEY, ctx.previous);
      showError(t("dialog.couldNotSave"));
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
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(QUERY_KEY, ctx.previous);
      showError(t("dialog.couldNotDelete"));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  // The API has no undelete, so "undo" recreates the note from the snapshot.
  const restoreMutation = useMutation({
    mutationFn: (note: Note) =>
      jsonRequest<Note>("/api/notes", "POST", {
        body: note.body,
        color: isMemberColor(note.color) ? note.color : "sun",
        authorMemberId: note.authorMemberId,
        pinned: note.pinned,
      } satisfies NoteCreateInput),
    onError: () => showError(t("couldNotRestore")),
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
  async function confirmDelete(note: Note) {
    await deleteMutation.mutateAsync(note.id);
    setToast({ kind: "undo", note });
  }
  function handleTogglePin(note: Note) {
    patchMutation.mutate({ id: note.id, patch: { pinned: !note.pinned } });
  }

  const isEmpty = !isLoading && notes.length === 0 && !isError;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {t("title")}
        </h2>
        <Button onClick={openNew}>
          <Plus className="size-5" strokeWidth={2.75} />
          {t("addNote")}
        </Button>
      </div>

      {isLoading && (
        <div className="columns-1 gap-4 md:columns-2 xl:columns-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="mb-4 h-36 break-inside-avoid rounded-3xl" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <ErrorState onRetry={() => void refetch()} detail={t("couldNotLoad")} />
      )}

      {isEmpty && (
        <EmptyState
          picto="nav-notes"
          title={t("empty")}
          description={t("emptyDesc")}
          onCreate={openNew}
          createLabel={t("writeFirst")}
        />
      )}

      {!isLoading && !isError && !isEmpty && (
        <div className="flex flex-col gap-6">
          {pinned.length > 0 && (
            <section aria-label={t("pinned")} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
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
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            </section>
          )}
          {others.length > 0 && (
            <section aria-label={t("title")} className="flex flex-col gap-2">
              {pinned.length > 0 && (
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
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
                    onDelete={setDeleteTarget}
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
          const removed = notes.find((n) => n.id === id);
          await deleteMutation.mutateAsync(id);
          if (removed) setToast({ kind: "undo", note: removed });
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t("deleteConfirm")}
        picto="nav-notes"
        onConfirm={() => (deleteTarget ? confirmDelete(deleteTarget) : undefined)}
      />

      {toast?.kind === "error" && (
        <KidToast tone="error" picto="oops" durationMs={8000} onDismiss={() => setToast(null)}>
          {toast.text}
        </KidToast>
      )}
      {toast?.kind === "undo" && (
        <KidToast
          tone="success"
          picto="nav-notes"
          durationMs={8000}
          action={{
            kind: "undo",
            color: toast.note.color,
            onClick: () => restoreMutation.mutate(toast.note),
          }}
          onDismiss={() => setToast(null)}
        >
          <span className="line-clamp-2">{t("deleted")}</span>
        </KidToast>
      )}
    </div>
  );
}
