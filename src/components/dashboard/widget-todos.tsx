"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Check, ListChecks } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";
import type { Todo, TodoPatchInput } from "@/components/todos/types";
import { WidgetHeader } from "./widget-header";

type WidgetTodosProps = {
  className?: string;
};

const QUERY_KEY: QueryKey = ["todos"];

async function fetchTodos(): Promise<Todo[]> {
  const res = await fetch("/api/todos", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load to-dos (${res.status})`);
  }
  return (await res.json()) as Todo[];
}

async function patchTodo(id: string, patch: TodoPatchInput): Promise<Todo> {
  const res = await fetch(`/api/todos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Update failed (${res.status})`);
  return (await res.json()) as Todo;
}

export function WidgetTodos({ className }: WidgetTodosProps) {
  const t = useTranslations("dashboard.widgets.todos");
  const queryClient = useQueryClient();
  const { data: todos = [], isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchTodos,
    staleTime: 60_000,
  });

  const toggleMutation = useMutation({
    mutationFn: (args: { id: string; done: boolean }) =>
      patchTodo(args.id, { done: args.done }),
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<Todo[]>(QUERY_KEY) ?? [];
      queryClient.setQueryData<Todo[]>(
        QUERY_KEY,
        previous.map((t) =>
          t.id === args.id
            ? { ...t, done: args.done, updatedAt: new Date().toISOString() }
            : t,
        ),
      );
      return { previous };
    },
    onError: (_err, _args, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(QUERY_KEY, ctx.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const open = todos
    .filter((t) => !t.done)
    .sort((a, b) => {
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      if (aDue !== bDue) return aDue - bDue;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    })
    .slice(0, 4);

  return (
    <GlassCard className={cn("p-6 flex flex-col gap-4", className)}>
      <WidgetHeader
        title={t("title")}
        action={
          <span className="tabular text-xs text-muted">
            {t("open", { count: todos.filter((t) => !t.done).length })}
          </span>
        }
      />
      <ul className="flex flex-1 flex-col gap-2" aria-label={t("title")}>
        {isLoading && (
          <li className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
            {t("empty")}
          </li>
        )}
        {!isLoading && error && (
          <li className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-accent-rose/40 px-4 py-10 text-center text-sm text-accent-rose">
            {t("couldNotLoad")}
          </li>
        )}
        {!isLoading && !error && open.length === 0 && (
          <li className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
            <ListChecks className="size-5" />
            {t("empty")}
          </li>
        )}
        {open.map((todo) => (
          <li
            key={todo.id}
            className="flex items-center gap-3 rounded-2xl border border-border bg-bg/30 px-3 py-2"
          >
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() =>
                toggleMutation.mutate({ id: todo.id, done: !todo.done })
              }
              aria-label={`Mark ${todo.title} done`}
              aria-pressed={todo.done}
              className={cn(
                "size-12 tap-target shrink-0 inline-flex items-center justify-center rounded-full",
                "border-2 transition-colors",
                todo.done
                  ? "border-ink bg-ink text-bg"
                  : "border-border bg-surface text-transparent hover:border-ink/40",
              )}
            >
              <Check className="size-5" strokeWidth={3} />
            </motion.button>
            <span className="flex-1 truncate text-sm text-ink">{todo.title}</span>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
