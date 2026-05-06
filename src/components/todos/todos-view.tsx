"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { ChevronDown, ListChecks } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";
import { TodoInput } from "./todo-input";
import { TodoRow } from "./todo-row";
import type { Todo, TodoCreateInput, TodoMember, TodoPatchInput } from "./types";

type TodosViewProps = {
  initialMembers: TodoMember[];
};

const QUERY_KEY: QueryKey = ["todos"];

async function fetchTodos(): Promise<Todo[]> {
  const res = await fetch("/api/todos", { cache: "no-store" });
  if (!res.ok) {
    let message = `Failed to load to-dos (${res.status})`;
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      if (data?.error?.message) message = data.error.message;
    } catch {
      // ignore
    }
    throw new Error(message);
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

function compareTodos(a: Todo, b: Todo): number {
  const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
  const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
  if (aDue !== bDue) return aDue - bDue;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export function TodosView({ initialMembers }: TodosViewProps) {
  const t = useTranslations("todos");
  const queryClient = useQueryClient();
  const { data: todos = [], isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchTodos,
  });
  const [showCompleted, setShowCompleted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
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
    onError: (err, _input, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(QUERY_KEY, ctx.previous);
      showToast(err instanceof Error ? err.message : t("couldNotAdd"));
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
    onError: (err, _args, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(QUERY_KEY, ctx.previous);
      showToast(err instanceof Error ? err.message : t("couldNotUpdate"));
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
    onError: (err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(QUERY_KEY, ctx.previous);
      showToast(err instanceof Error ? err.message : t("couldNotDelete"));
    },
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
  function handleDelete(todo: Todo) {
    deleteMutation.mutate(todo.id);
  }

  const isEmpty = !isLoading && todos.length === 0 && !error;

  const countLabel = completed.length > 0
    ? t("openAndDone", { open: pending.length, done: completed.length })
    : t("open", { open: pending.length });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl tracking-tight text-ink sm:text-3xl">
          {t("title")}
        </h2>
        <span className="tabular text-sm text-muted">
          {countLabel}
        </span>
      </div>

      <TodoInput members={initialMembers} onSubmit={handleCreate} />

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-accent-rose/40 bg-accent-rose/10 px-4 py-3 text-sm text-ink"
        >
          {error instanceof Error ? error.message : t("couldNotLoad")}
        </div>
      )}

      {isEmpty ? (
        <EmptyState />
      ) : (
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
                    onDelete={handleDelete}
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
                  "tap-target inline-flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2 text-sm",
                  "text-muted hover:bg-bg",
                )}
              >
                <span className="tabular">
                  {t("completedSection", { count: completed.length })}
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
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
                    aria-label={t("noCompleted")}
                  >
                    {completed.map((todo) => (
                      <TodoRow
                        key={todo.id}
                        todo={todo}
                        member={
                          todo.memberId ? membersById.get(todo.memberId) ?? null : null
                        }
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                      />
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

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

function EmptyState() {
  const t = useTranslations("todos");

  return (
    <GlassCard className="mx-auto flex w-full max-w-md flex-col items-center gap-3 p-10 text-center">
      <span
        className="inline-flex size-16 items-center justify-center rounded-full bg-accent-mint/30 text-ink"
        aria-hidden
      >
        <ListChecks className="size-8" />
      </span>
      <h3 className="font-display text-2xl tracking-tight text-ink">
        {t("noActive")}
      </h3>
      <p className="text-sm text-muted">
        {t("noActiveDesc")}
      </p>
    </GlassCard>
  );
}
