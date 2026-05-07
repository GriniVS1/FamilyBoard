"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { CalendarDays, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shared/button";
import { CaldavConnectDialog } from "./caldav-connect-dialog";
import type { CalendarMember } from "@/components/calendar/types";

type CaldavStatus = {
  connected: boolean;
  serverUrl?: string;
  username?: string;
  calendarName?: string;
  lastSyncedAt?: string;
};

type CaldavRowProps = {
  member: CalendarMember;
};

async function fetchCaldavStatus(memberId: string): Promise<CaldavStatus> {
  const res = await fetch(`/api/members/${memberId}/caldav-status`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Status failed (${res.status})`);
  return (await res.json()) as CaldavStatus;
}

export function CaldavRow({ member }: CaldavRowProps) {
  const t = useTranslations("settings.caldav");
  const [connectOpen, setConnectOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: status, isLoading, isError } = useQuery({
    queryKey: ["caldav-status", member.id],
    queryFn: () => fetchCaldavStatus(member.id),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/members/${member.id}/disconnect-caldav`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`Disconnect failed (${res.status})`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["caldav-status", member.id],
      });
    },
    onError: (err) => {
      setActionError(
        err instanceof Error ? err.message : t("networkError"),
      );
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sync/caldav`, { method: "POST" });
      if (!res.ok) throw new Error(`Sync failed (${res.status})`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["caldav-status", member.id],
      });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : t("networkError"));
    },
  });

  function handleConnectClose(open: boolean) {
    setConnectOpen(open);
    if (!open) {
      void queryClient.invalidateQueries({
        queryKey: ["caldav-status", member.id],
      });
    }
  }

  const lastSyncLabel = status?.lastSyncedAt
    ? formatDistanceToNow(new Date(status.lastSyncedAt), { addSuffix: true })
    : t("never");

  return (
    <>
      <div className="rounded-2xl border border-border bg-bg/30 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-10 inline-flex items-center justify-center rounded-full bg-surface border border-border shrink-0">
            <CalendarDays className="size-4 text-accent-mint" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink">{t("title")}</div>
            {isLoading ? (
              <div className="text-xs text-muted">{t("description")}</div>
            ) : isError ? (
              <div className="text-xs text-accent-rose">{t("networkError")}</div>
            ) : status?.connected ? (
              <div className="text-xs text-muted truncate">
                {status.calendarName ?? t("calendar")} ·{" "}
                {t("lastSynced")}: {lastSyncLabel}
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
                  if (window.confirm(t("disconnectConfirm"))) {
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
          ) : (
            <Button
              type="button"
              variant="primary"
              onClick={() => setConnectOpen(true)}
              aria-label={t("connectAria")}
            >
              {t("connect")}
            </Button>
          )}
        </div>

        {actionError && (
          <p className="text-xs text-accent-rose sm:basis-full" role="alert">
            {actionError}
          </p>
        )}
      </div>

      <CaldavConnectDialog
        open={connectOpen}
        onOpenChange={handleConnectClose}
        memberId={member.id}
      />
    </>
  );
}
