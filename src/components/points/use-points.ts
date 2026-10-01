"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import type {
  ChoresPayload,
  PointResetRecord,
  PointResetResponse,
  PointResetUndoResponse,
  PointsOverview,
} from "@/components/chores/types";
import {
  CHORES_QUERY_KEY,
  ChoresRequestError,
  failureKindOf,
  type FailureKind,
} from "@/components/chores/use-chores";

import { POINTS_QUERY_KEY } from "./query-key";

async function send(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new ChoresRequestError("offline");
  }
}

export function usePointsQuery() {
  return useQuery({
    queryKey: POINTS_QUERY_KEY,
    queryFn: async () => {
      const res = await send("/api/points", { cache: "no-store" });
      if (!res.ok) throw new ChoresRequestError("server");
      return (await res.json()) as PointsOverview;
    },
    retry: 1,
    retryDelay: 800,
    // The provider's 30 s staleTime would show numbers from before the last tick.
    staleTime: 0,
    refetchOnMount: "always",
  });
}

type UndoOutcome = { failed: PointResetRecord[]; kind: FailureKind | null };

/** Network and cache side of resetting and un-resetting; the UI never sees the server's text. */
function usePointResets() {
  const client = useQueryClient();

  const refresh = useCallback(() => {
    void client.invalidateQueries({ queryKey: CHORES_QUERY_KEY });
    void client.invalidateQueries({ queryKey: POINTS_QUERY_KEY });
  }, [client]);

  const reset = useCallback(
    async (memberIds: string[]): Promise<PointResetRecord[]> => {
      const res = await send("/api/points/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds }),
      });
      if (!res.ok) throw new ChoresRequestError("server");
      const { resets } = (await res.json()) as PointResetResponse;

      client.setQueryData<ChoresPayload>(CHORES_QUERY_KEY, (prev) => {
        if (!prev) return prev;
        const cleared = Object.fromEntries(
          resets.map((r) => [r.memberId, { balance: 0, since: r.resetAt }]),
        );
        return { ...prev, balanceByMember: { ...prev.balanceByMember, ...cleared } };
      });
      refresh();
      return resets;
    },
    [client, refresh],
  );

  const undo = useCallback(
    async (resets: PointResetRecord[]): Promise<UndoOutcome> => {
      const outcomes = await Promise.all(
        resets.map(async (record) => {
          try {
            const res = await send(`/api/points/reset/${encodeURIComponent(record.id)}`, {
              method: "DELETE",
            });
            // Already gone (undone from the phone, say): the balance is back either way.
            if (res.status === 404) return { record, kind: null };
            if (!res.ok) return { record, kind: "server" as const };
            const body = (await res.json()) as PointResetUndoResponse;
            client.setQueryData<ChoresPayload>(CHORES_QUERY_KEY, (prev) =>
              prev
                ? {
                    ...prev,
                    balanceByMember: {
                      ...prev.balanceByMember,
                      [body.memberId]: {
                        balance: body.balance,
                        since: prev.balanceByMember[body.memberId]?.since ?? null,
                      },
                    },
                  }
                : prev,
            );
            return { record, kind: null };
          } catch (err) {
            return { record, kind: failureKindOf(err) };
          }
        }),
      );
      refresh();
      const failed = outcomes.filter((o) => o.kind !== null);
      return { failed: failed.map((o) => o.record), kind: failed[0]?.kind ?? null };
    },
    [client, refresh],
  );

  return useMemo(() => ({ reset, undo }), [reset, undo]);
}

type PointsRetry =
  | { type: "reset"; memberIds: string[] }
  | { type: "undo"; resets: PointResetRecord[] };

export type PointsToastState =
  | { id: number; kind: "reset"; resets: PointResetRecord[] }
  | { id: number; kind: "error"; failure: FailureKind; retry: PointsRetry };

/**
 * Owns the one toast that follows a reset: the 8 s ↶ on success, a retry on
 * failure. The page renders it, because the overview closes first so the
 * toast is not covered by the dialog's overlay.
 */
export function usePointsFlow() {
  const actions = usePointResets();
  const [toast, setToast] = useState<PointsToastState | null>(null);
  const seq = useRef(0);

  const dismiss = useCallback(() => setToast(null), []);

  const reset = useCallback(
    async (memberIds: string[]): Promise<void> => {
      const id = (seq.current += 1);
      try {
        const resets = await actions.reset(memberIds);
        setToast(resets.length > 0 ? { id, kind: "reset", resets } : null);
      } catch (err) {
        setToast({ id, kind: "error", failure: failureKindOf(err), retry: { type: "reset", memberIds } });
      }
    },
    [actions],
  );

  const undo = useCallback(
    async (resets: PointResetRecord[]): Promise<void> => {
      const id = (seq.current += 1);
      const { failed, kind } = await actions.undo(resets);
      if (failed.length > 0 && kind) {
        setToast({ id, kind: "error", failure: kind, retry: { type: "undo", resets: failed } });
      }
    },
    [actions],
  );

  const retry = useCallback(
    (what: PointsRetry): Promise<void> =>
      what.type === "reset" ? reset(what.memberIds) : undo(what.resets),
    [reset, undo],
  );

  return { toast, reset, undo, retry, dismiss };
}
