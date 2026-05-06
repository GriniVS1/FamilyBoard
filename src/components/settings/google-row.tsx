"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Link2, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/shared/button";
import type { CalendarMember } from "@/components/calendar/types";

type GoogleStatus = {
  connected: boolean;
  email?: string;
  syncEnabled: boolean;
  lastSyncAt?: string;
};

type GoogleRowProps = {
  member: CalendarMember;
};

async function fetchStatus(memberId: string): Promise<GoogleStatus> {
  const res = await fetch(`/api/members/${memberId}/google-status`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Status failed (${res.status})`);
  }
  return (await res.json()) as GoogleStatus;
}

export function GoogleRow({ member }: GoogleRowProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: status, isLoading, isError } = useQuery({
    queryKey: ["google-status", member.id],
    queryFn: () => fetchStatus(member.id),
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/members/${member.id}/connect-google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        let message = `Connect failed (${res.status})`;
        try {
          const data = (await res.json()) as { error?: { message?: string } };
          if (data?.error?.message) message = data.error.message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      return (await res.json()) as { authorizeUrl: string };
    },
    onSuccess: (data) => {
      window.location.href = data.authorizeUrl;
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Could not start OAuth.");
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/members/${member.id}/connect-google`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Disconnect failed (${res.status})`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["google-status", member.id] });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Could not disconnect.");
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/members/${member.id}/sync`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`Sync failed (${res.status})`);
      return (await res.json()) as {
        pulled: number;
        pushed: number;
        deleted: number;
        skipped: number;
      };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["google-status", member.id] });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Sync failed.");
    },
  });

  const lastSyncLabel = status?.lastSyncAt
    ? `${formatDistanceToNow(new Date(status.lastSyncAt))} ago`
    : "never";

  return (
    <div className="rounded-2xl border border-border bg-bg/30 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <div className="size-10 inline-flex items-center justify-center rounded-full bg-surface border border-border">
          <Link2 className="size-4 text-accent-sky" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink">Google Calendar</div>
          {isLoading ? (
            <div className="text-xs text-muted">Checking…</div>
          ) : isError ? (
            <div className="text-xs text-accent-rose">Could not load status.</div>
          ) : status?.connected ? (
            <div className="text-xs text-muted truncate">
              {status.email ?? "Connected"} · last sync {lastSyncLabel}
            </div>
          ) : (
            <div className="text-xs text-muted">Not connected</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {status?.connected ? (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Sync now
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="text-accent-rose hover:bg-accent-rose/10"
              aria-label="Disconnect"
            >
              <Trash2 className="size-4" />
              <span className="hidden sm:inline">Disconnect</span>
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="primary"
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
          >
            {connectMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Connect Google
          </Button>
        )}
      </div>

      {actionError && (
        <p className="text-xs text-accent-rose sm:basis-full" role="alert">
          {actionError}
        </p>
      )}
    </div>
  );
}
