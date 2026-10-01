"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Chore,
  ChoreCompletionResponse,
  ChoreCompletionToday,
  ChoreInput,
  ChoresPayload,
} from "./types";
import { POINTS_QUERY_KEY } from "@/components/points/query-key";
import { adjustCounters } from "./counters";

export const CHORES_QUERY_KEY = ["chores"] as const;

/** How long the ↶ stays on a card right after ticking it. */
export const FRESH_UNDO_MS = 8000;
/** How long ↶ shows after a tap on an older done card. */
export const REVEALED_UNDO_MS = 5000;

export type FailureKind = "offline" | "server";

/** The UI only ever sees the kind, never the server's text (AK-11). */
export class ChoresRequestError extends Error {
  readonly kind: FailureKind;

  constructor(kind: FailureKind) {
    super(kind);
    this.kind = kind;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ChoresRequestError("offline");
  }
  if (!res.ok) throw new ChoresRequestError("server");
  return (await res.json()) as T;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export function failureKindOf(err: unknown): FailureKind {
  return err instanceof ChoresRequestError ? err.kind : "server";
}

export function useChoresQuery() {
  return useQuery({
    queryKey: CHORES_QUERY_KEY,
    queryFn: () => request<ChoresPayload>("/api/chores", { cache: "no-store" }),
    // The kiosk never refocuses, so polling is how phone-made changes arrive.
    refetchInterval: 60_000,
    retry: 2,
    retryDelay: 800,
  });
}

function addCompletion(client: QueryClient, completion: ChoreCompletionToday, points: number): void {
  client.setQueryData<ChoresPayload>(CHORES_QUERY_KEY, (prev) => {
    if (!prev) return prev;
    const next = adjustCounters(prev, {
      memberId: completion.memberId,
      choreId: completion.choreId,
      points,
      completedAt: completion.completedAt,
      sign: 1,
    });
    return { ...next, completionsToday: [...prev.completionsToday, completion] };
  });
}

function dropCompletion(client: QueryClient, completionId: string, memberId: string, choreId: string, points: number): void {
  client.setQueryData<ChoresPayload>(CHORES_QUERY_KEY, (prev) => {
    if (!prev) return prev;
    const target = prev.completionsToday.find((c) => c.id === completionId);
    if (!target) return prev;
    const next = adjustCounters(prev, { memberId, choreId, points, completedAt: target.completedAt, sign: -1 });
    return { ...next, completionsToday: prev.completionsToday.filter((c) => c.id !== completionId) };
  });
}

function swapCompletion(client: QueryClient, tmpId: string, real: ChoreCompletionToday): void {
  client.setQueryData<ChoresPayload>(CHORES_QUERY_KEY, (prev) => {
    if (!prev) return prev;
    const swapped = prev.completionsToday.map((c) => (c.id === tmpId ? { ...c, ...real } : c));
    return { ...prev, completionsToday: swapped };
  });
}

export type ChoreActionEvent =
  | { type: "completed"; chore: Chore; memberId: string }
  | { type: "failed"; chore: Chore; memberId: string; kind: FailureKind }
  | { type: "undone"; chore: Chore; memberId: string }
  | { type: "undoFailed"; chore: Chore; memberId: string; kind: FailureKind };

export type UndoWindow = { ms: number; startedAt: number; kind: "fresh" | "revealed" };

type FailedMap = Record<string, { memberId: string; kind: FailureKind }>;

/**
 * Tick / undo with optimistic cache updates. Requests for one chore run one
 * after another (a new tick waits for a pending delete), and an undo of a
 * completion whose POST is still in flight flips the cache at once and sends
 * the DELETE when the POST lands, so neither tap is ever dropped.
 */
export function useChoreActions(onEvent: (event: ChoreActionEvent) => void) {
  const client = useQueryClient();
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState<FailedMap>({});
  const [undoWindows, setUndoWindows] = useState<Record<string, UndoWindow>>({});

  const eventRef = useRef(onEvent);
  const chains = useRef(new Map<string, Promise<void>>());
  const queued = useRef(new Map<string, number>());
  const active = useRef(0);
  const cancelledTmp = useRef(new Set<string>());
  const timers = useRef(new Map<string, number>());
  const seq = useRef(0);

  useEffect(() => {
    eventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const live = timers.current;
    return () => {
      for (const id of live.values()) window.clearTimeout(id);
    };
  }, []);

  const closeUndo = useCallback((choreId: string) => {
    const timer = timers.current.get(choreId);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(choreId);
    setUndoWindows((w) => {
      if (!(choreId in w)) return w;
      const next = { ...w };
      delete next[choreId];
      return next;
    });
  }, []);

  const openUndo = useCallback(
    (choreId: string, ms: number, kind: UndoWindow["kind"]) => {
      const previous = timers.current.get(choreId);
      if (previous !== undefined) window.clearTimeout(previous);
      setUndoWindows((w) => ({ ...w, [choreId]: { ms, startedAt: Date.now(), kind } }));
      timers.current.set(
        choreId,
        window.setTimeout(() => closeUndo(choreId), ms),
      );
    },
    [closeUndo],
  );

  const enqueue = useCallback(
    (choreId: string, task: () => Promise<void>): Promise<void> => {
      queued.current.set(choreId, (queued.current.get(choreId) ?? 0) + 1);
      setPending((s) => new Set(s).add(choreId));
      active.current += 1;

      const previous = chains.current.get(choreId) ?? Promise.resolve();
      const run = previous.then(task).finally(() => {
        const left = (queued.current.get(choreId) ?? 1) - 1;
        if (left <= 0) {
          queued.current.delete(choreId);
          chains.current.delete(choreId);
          setPending((s) => {
            const next = new Set(s);
            next.delete(choreId);
            return next;
          });
        } else {
          queued.current.set(choreId, left);
        }
        active.current -= 1;
        // A refetch while other requests are still out would overwrite their optimistic state.
        if (active.current === 0) {
          void client.invalidateQueries({ queryKey: CHORES_QUERY_KEY });
          void client.invalidateQueries({ queryKey: POINTS_QUERY_KEY });
        }
      });
      chains.current.set(choreId, run);
      return run;
    },
    [client],
  );

  const complete = useCallback(
    (chore: Chore, memberId: string): Promise<void> => {
      const payload = client.getQueryData<ChoresPayload>(CHORES_QUERY_KEY);
      if (payload?.completionsToday.some((c) => c.choreId === chore.id)) return Promise.resolve();

      void client.cancelQueries({ queryKey: CHORES_QUERY_KEY });
      seq.current += 1;
      const tmpId = `tmp-${seq.current}`;
      addCompletion(
        client,
        { id: tmpId, choreId: chore.id, memberId, completedAt: new Date().toISOString() },
        chore.points,
      );
      setFailed((f) => {
        if (!(chore.id in f)) return f;
        const next = { ...f };
        delete next[chore.id];
        return next;
      });
      openUndo(chore.id, FRESH_UNDO_MS, "fresh");
      eventRef.current({ type: "completed", chore, memberId });

      return enqueue(chore.id, async () => {
        if (cancelledTmp.current.delete(tmpId)) return;
        try {
          const res = await request<ChoreCompletionResponse>(
            `/api/chores/${chore.id}/complete`,
            jsonInit("POST", { memberId }),
          );
          if (cancelledTmp.current.delete(tmpId)) {
            await request(`/api/chores/${chore.id}/completions/${res.completion.id}`, {
              method: "DELETE",
            }).catch(() => undefined);
          } else {
            swapCompletion(client, tmpId, res.completion);
          }
        } catch (err) {
          cancelledTmp.current.delete(tmpId);
          dropCompletion(client, tmpId, memberId, chore.id, chore.points);
          closeUndo(chore.id);
          const kind = failureKindOf(err);
          setFailed((f) => ({ ...f, [chore.id]: { memberId, kind } }));
          eventRef.current({ type: "failed", chore, memberId, kind });
        }
      });
    },
    [client, openUndo, closeUndo, enqueue],
  );

  const undo = useCallback(
    (chore: Chore): Promise<void> => {
      const payload = client.getQueryData<ChoresPayload>(CHORES_QUERY_KEY);
      const target = [...(payload?.completionsToday ?? [])].reverse().find((c) => c.choreId === chore.id);
      if (!target) return Promise.resolve();

      dropCompletion(client, target.id, target.memberId, chore.id, chore.points);
      closeUndo(chore.id);
      eventRef.current({ type: "undone", chore, memberId: target.memberId });

      if (target.id.startsWith("tmp-")) {
        cancelledTmp.current.add(target.id);
        return Promise.resolve();
      }

      return enqueue(chore.id, async () => {
        try {
          await request(`/api/chores/${chore.id}/completions/${target.id}`, { method: "DELETE" });
        } catch (err) {
          addCompletion(client, target, chore.points);
          eventRef.current({ type: "undoFailed", chore, memberId: target.memberId, kind: failureKindOf(err) });
        }
      });
    },
    [client, closeUndo, enqueue],
  );

  const revealUndo = useCallback(
    (choreId: string) => openUndo(choreId, REVEALED_UNDO_MS, "revealed"),
    [openUndo],
  );

  return { complete, undo, revealUndo, pending, failed, undoWindows };
}

export function useChoreAdmin() {
  const client = useQueryClient();

  const save = useCallback(
    async (input: ChoreInput, choreId: string | null) => {
      await request<Chore>(
        choreId ? `/api/chores/${choreId}` : "/api/chores",
        jsonInit(choreId ? "PATCH" : "POST", input),
      );
      await client.invalidateQueries({ queryKey: CHORES_QUERY_KEY });
    },
    [client],
  );

  const remove = useCallback(
    async (choreId: string) => {
      await request<{ ok: true }>(`/api/chores/${choreId}`, { method: "DELETE" });
      await client.invalidateQueries({ queryKey: CHORES_QUERY_KEY });
    },
    [client],
  );

  return { save, remove };
}
