"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Mail, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shared/button";
import type { CalendarMember } from "@/components/calendar/types";

type MicrosoftStatus = {
  connected: boolean;
  email?: string;
  calendarName?: string;
  lastSyncedAt?: string;
};

type MicrosoftRowProps = {
  member: CalendarMember;
  adminPin: string;
};

async function fetchMicrosoftStatus(memberId: string): Promise<MicrosoftStatus> {
  const res = await fetch(`/api/members/${memberId}/microsoft-status`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Status failed (${res.status})`);
  }
  return (await res.json()) as MicrosoftStatus;
}

export function MicrosoftRow({ member, adminPin }: MicrosoftRowProps) {
  const t = useTranslations("settings.microsoft");
  const [actionError, setActionError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: status, isLoading, isError } = useQuery({
    queryKey: ["microsoft-status", member.id],
    queryFn: () => fetchMicrosoftStatus(member.id),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/members/${member.id}/disconnect-microsoft`, {
        method: "POST",
        headers: { "X-Admin-Pin": adminPin },
      });
      if (!res.ok) throw new Error(`Disconnect failed (${res.status})`);
    },
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["microsoft-status", member.id] });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : t("disconnect"));
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sync/microsoft`, {
        method: "POST",
        headers: { "X-Admin-Pin": adminPin },
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
      void queryClient.invalidateQueries({ queryKey: ["microsoft-status", member.id] });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : t("syncing"));
    },
  });

  const lastSyncLabel = status?.lastSyncedAt
    ? formatDistanceToNow(new Date(status.lastSyncedAt), { addSuffix: true })
    : t("never");

  return (
    <div className="rounded-2xl border border-border bg-bg/30 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <div className="size-10 inline-flex items-center justify-center rounded-full bg-surface border border-border shrink-0">
          <Mail className="size-4 text-accent-sky" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink">{t("title")}</div>
          {isLoading ? (
            <div className="text-xs text-muted">{t("description")}</div>
          ) : isError ? (
            <div className="text-xs text-accent-rose">{t("notConfigured")}</div>
          ) : status?.connected ? (
            <div className="text-xs text-muted truncate">
              {status.email ?? t("connected")} · {t("lastSynced")}: {lastSyncLabel}
            </div>
          ) : (
            <div className="text-xs text-muted">{t("description")}</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
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
              {syncMutation.isPending ? t("syncing") : t("syncNow")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (window.confirm(t("disconnect") + "?")) {
                  disconnectMutation.mutate();
                }
              }}
              disabled={disconnectMutation.isPending}
              className="text-accent-rose hover:bg-accent-rose/10"
              aria-label={t("disconnect")}
            >
              {disconnectMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              <span className="hidden sm:inline">{t("disconnect")}</span>
            </Button>
          </>
        ) : null}
      </div>

      {actionError && (
        <p className="text-xs text-accent-rose sm:basis-full" role="alert">
          {actionError}
        </p>
      )}
    </div>
  );
}
