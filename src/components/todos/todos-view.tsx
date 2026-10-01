"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/kids/confirm-dialog";
import { KidToast } from "@/components/kids/kid-toast";
import { EmptyState, ErrorState, Skeleton } from "@/components/kids/state-views";
import { cn } from "@/lib/utils";
import { TodoInput } from "./todo-input";
import { TodoRow } from "./todo-row";
import type { Todo, TodoCreateInput, TodoMember, TodoPatchInput } from "./types";

type TodosViewProps = {
  initialMembers: TodoMember[];
};

type Toast =
  | { kind: "error"; text: string }
  | { kind: "undo"; todo: Todo };

const QUERY_KEY: QueryKey = ["todos"];

async function fetchTodos(): Promise<Todo[]> {
  const res = await fetch("/api/todos", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`todos ${res.status}`);
  }
  return (await res.json()) as Todo[];
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

function compareTodos(a: Todo, b: Todo): number {
  const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
  const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
  if (aDue !== bDue) return aDue - bDue;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export function TodosView({ initialMembers }: TodosViewProps) {
  const t = useTranslations("todos");
  const queryClient = useQueryClient();
  const { data: todos = [], isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchTodos,
    refetchInterval: 60_000, // kiosk never refocuses — poll for remote changes
  });
  const [showCompleted, setShowCompleted] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Todo | null>(null);

  const membersById = useMemo(() => {
    const map = new Map<string, TodoMember>();
    for (const m of initialMembers) map.set(m.id, m);
    return map;
  }, [initialMembers]);

  const { pending, completed } = useMemo(() => {
    const p: Todo[] = [];
    const c: Todo[] = [];
    for (const todo of todos) {
      if (todo.done) c.push(todo);
      else p.push(todo);
    }
    p.sort(compareTodos);
    c.sort(
      (a, b) =>
        new Date(b.updatedAt ?? b.createdAt).getTime() -
        new Date(a.updatedAt ?? a.createdAt).getTime(),
    );
    return { pending: p, completed: c };
  }, [todos]);

  function showError(text: string) {
    setToast({ kind: "error", text });
  }

  const createMutation = useMutation({
    mutationFn: (input: TodoCreateInput) =>
      jsonRequest<Todo>("/api/todos", "POST", input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<Todo[]>(QUERY_KEY) ?? [];
      const optimistic: Todo = {
        id: `temp-${Date.now()}`,
        familyId: "",
        memberId: input.memberId ?? null,
        title: input.title,
        done: false,
        dueDate: input.dueDate ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<Todo[]>(QUERY_KEY, [...previous, optimistic]);
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(QUERY_KEY, ctx.previous);
      showError(t("couldNotAdd"));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const patchMutation = useMutation({
    mutationFn: (args: { id: string; patch: TodoPatchInput }) =>
      jsonRequest<Todo>(`/api/todos/${args.id}`, "PATCH", args.patch),
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<Todo[]>(QUERY_KEY) ?? [];
      queryClient.setQueryData<Todo[]>(
        QUERY_KEY,
        previous.map((todoItem) =>
          todoItem.id === args.id
            ? {
                ...todoItem,
                ...args.patch,
                updatedAt: new Date().toISOString(),
              }
            : todoItem,
        ),
      );
      return { previous };
    },
    onError: (_err, _args, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(QUERY_KEY, ctx.previous);
      showError(t("couldNotUpdate"));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      jsonRequest<{ ok: true }>(`/api/todos/${id}`, "DELETE"),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<Todo[]>(QUERY_KEY) ?? [];
      queryClient.setQueryData<Todo[]>(
        QUERY_KEY,
        previous.filter((todoItem) => todoItem.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(QUERY_KEY, ctx.previous);
      showError(t("couldNotDelete"));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  // The API has no undelete, so "undo" recreates the row from the snapshot.
  const restoreMutation = useMutation({
    mutationFn: async (todo: Todo) => {
      const created = await jsonRequest<Todo>("/api/todos", "POST", {
        title: todo.title,
        memberId: todo.memberId,
        dueDate: todo.dueDate,
      } satisfies TodoCreateInput);
      if (todo.done) {
        await jsonRequest<Todo>(`/api/todos/${created.id}`, "PATCH", { done: true });
      }
    },
    onError: () => showError(t("couldNotRestore")),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  async function handleCreate(input: TodoCreateInput) {
    await createMutation.mutateAsync(input);
  }
  function handleToggle(todo: Todo) {
    patchMutation.mutate({ id: todo.id, patch: { done: !todo.done } });
  }
  async function confirmDelete(todo: Todo) {
    await deleteMutation.mutateAsync(todo.id);
    setToast({ kind: "undo", todo });
  }
  function handleDueDateChange(todo: Todo, dueDate: string | null) {
    patchMutation.mutate({ id: todo.id, patch: { dueDate } });
  }

  const isEmpty = !isLoading && todos.length === 0 && !isError;

  const countLabel = completed.length > 0
    ? t("openAndDone", { open: pending.length, done: completed.length })
    : t("open", { open: pending.length });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {t("title")}
        </h2>
        {!isLoading && !isError && (
          <span className="kid-label tabular text-muted">{countLabel}</span>
        )}
      </div>

      <TodoInput members={initialMembers} onSubmit={handleCreate} />

      {isLoading && (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[72px] rounded-2xl" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <ErrorState onRetry={() => void refetch()} detail={t("couldNotLoad")} />
      )}

      {isEmpty && (
        <EmptyState picto="relax" title={t("noActive")} description={t("noActiveDesc")} />
      )}

      {!isLoading && !isError && !isEmpty && (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2" aria-label={t("title")}>
            <AnimatePresence initial={false}>
              {pending.map((todo) => (
                <motion.div
                  key={todo.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.18 }}
                >
                  <TodoRow
                    todo={todo}
                    member={todo.memberId ? membersById.get(todo.memberId) ?? null : null}
                    onToggle={handleToggle}
                    onDelete={setDeleteTarget}
                    onDueDateChange={handleDueDateChange}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </ul>

          {completed.length > 0 && (
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCompleted((v) => !v)}
                aria-expanded={showCompleted}
                className={cn(
                  "kid-label inline-flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl px-3 py-2",
                  "text-muted hover:bg-ink/5 focus-ring-kid",
                )}
              >
                <span className="tabular">
                  {t("completedSection", { count: completed.length })}
                </span>
                <ChevronDown
                  className={cn(
                    "size-5 transition-transform",
                    showCompleted && "rotate-180",
                  )}
                />
              </button>
              <AnimatePresence initial={false}>
                {showCompleted && (
                  <motion.ul
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-2 overflow-hidden"
                    aria-label={t("completedSection", { count: completed.length })}
                  >
                    {completed.map((todo) => (
                      <TodoRow
                        key={todo.id}
                        todo={todo}
                        member={
                          todo.memberId ? membersById.get(todo.memberId) ?? null : null
                        }
                        onToggle={handleToggle}
                        onDelete={setDeleteTarget}
                        onDueDateChange={handleDueDateChange}
                      />
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={deleteTarget ? t("deleteConfirm", { title: deleteTarget.title }) : ""}
        picto="nav-todos"
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
          picto="nav-todos"
          durationMs={8000}
          action={{
            kind: "undo",
            color: membersById.get(toast.todo.memberId ?? "")?.color,
            onClick: () => restoreMutation.mutate(toast.todo),
          }}
          onDismiss={() => setToast(null)}
        >
          <span className="line-clamp-2">{t("deleted", { title: toast.todo.title })}</span>
        </KidToast>
      )}
    </div>
  );
}
