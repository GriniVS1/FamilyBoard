"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { EmptyState, ErrorState, Skeleton } from "@/components/kids/state-views";
import { GlassCard } from "@/components/shared/glass-card";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { cn } from "@/lib/utils";
import { TodoCheck } from "@/components/todos/todo-check";
import type { Todo, TodoPatchInput } from "@/components/todos/types";
import { WidgetHeader } from "./widget-header";

type WidgetMember = {
  id: string;
  name: string;
  color: string;
  emoji?: string | null;
};

type WidgetTodosProps = {
  className?: string;
  members?: WidgetMember[];
};

const QUERY_KEY: QueryKey = ["todos"];

async function fetchTodos(): Promise<Todo[]> {
  const res = await fetch("/api/todos", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`todos ${res.status}`);
  }
  return (await res.json()) as Todo[];
}

async function patchTodo(id: string, patch: TodoPatchInput): Promise<Todo> {
  const res = await fetch(`/api/todos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`todo ${res.status}`);
  return (await res.json()) as Todo;
}

export function WidgetTodos({ className, members = [] }: WidgetTodosProps) {
  const t = useTranslations("dashboard.widgets.todos");
  const tTodos = useTranslations("todos");
  const queryClient = useQueryClient();
  const { data: todos = [], isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchTodos,
    staleTime: 60_000,
    // The kiosk mounts this once and never refocuses — poll so phone-made
    // changes appear without waiting for a screensaver cycle.
    refetchInterval: 60_000,
  });

  const toggleMutation = useMutation({
    mutationFn: (args: { id: string; done: boolean }) =>
      patchTodo(args.id, { done: args.done }),
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<Todo[]>(QUERY_KEY) ?? [];
      queryClient.setQueryData<Todo[]>(
        QUERY_KEY,
        previous.map((item) =>
          item.id === args.id
            ? { ...item, done: args.done, updatedAt: new Date().toISOString() }
            : item,
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

  const membersById = new Map(members.map((m) => [m.id, m]));

  const openTodos = todos.filter((todo) => !todo.done);
  const visible = [...openTodos]
    .sort((a, b) => {
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      if (aDue !== bDue) return aDue - bDue;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    })
    .slice(0, 4);

  return (
    <GlassCard className={cn("flex flex-col gap-4 p-6", className)}>
      <WidgetHeader
        title={t("title")}
        action={
          isLoading || isError ? null : (
            <span className="tabular text-sm text-muted">
              {t("open", { count: openTodos.length })}
            </span>
          )
        }
      />
      {isLoading && (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="size-12 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      )}
      {isError && !isLoading && (
        <ErrorState size="md" onRetry={() => void refetch()} detail={t("couldNotLoad")} />
      )}
      {!isLoading && !isError && visible.length === 0 && (
        <EmptyState size="md" picto="relax" title={t("empty")} />
      )}
      {visible.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label={t("title")}>
          {visible.map((todo) => {
            const member = todo.memberId ? membersById.get(todo.memberId) : undefined;
            return (
              <li
                key={todo.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-bg/50 px-2 py-1.5"
              >
                <TodoCheck
                  done={todo.done}
                  color={member?.color}
                  label={tTodos("markDone", { title: todo.title })}
                  onClick={() => toggleMutation.mutate({ id: todo.id, done: !todo.done })}
                />
                <span className="kid-body line-clamp-2 min-w-0 flex-1 text-ink">{todo.title}</span>
                {member && (
                  <MemberAvatar
                    name={member.name}
                    color={member.color}
                    emoji={member.emoji}
                    size="sm"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}
