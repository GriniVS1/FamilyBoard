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

type ConnectError =
  | { kind: "not_configured" }
  | { kind: "provider_conflict"; detail: string }
  | { kind: "network"; detail: string };

export function MicrosoftRow({ member, adminPin }: MicrosoftRowProps) {
  const t = useTranslations("settings.microsoft");
  const [connectError, setConnectError] = useState<ConnectError | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: status, isLoading, isError } = useQuery({
    queryKey: ["microsoft-status", member.id],
    queryFn: () => fetchMicrosoftStatus(member.id),
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      setConnectError(null);
      const res = await fetch(`/api/members/${member.id}/connect-microsoft`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Pin": adminPin },
      });

      if (res.status === 503) {
        throw Object.assign(new Error("not_configured"), { code: "MICROSOFT_NOT_CONFIGURED" });
      }

      if (res.status === 400) {
        let detail = t("providerConflict");
        try {
          const data = (await res.json()) as { error?: { code?: string; message?: string } };
          if (data?.error?.message) detail = data.error.message;
        } catch {
          // ignore
        }
        throw Object.assign(new Error("provider_conflict"), { code: "PROVIDER_CONFLICT", detail });
      }

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
    onError: (err: Error & { code?: string; detail?: string }) => {
      if (err.code === "MICROSOFT_NOT_CONFIGURED") {
        setConnectError({ kind: "not_configured" });
      } else if (err.code === "PROVIDER_CONFLICT") {
        setConnectError({ kind: "provider_conflict", detail: err.detail ?? t("providerConflict") });
      } else {
        setConnectError({ kind: "network", detail: err.message });
      }
    },
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

  const isNotConfigured = connectError?.kind === "not_configured";

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
          ) : isNotConfigured ? (
            <div className="text-xs text-muted">{t("notConfiguredHelp")}</div>
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
        ) : isNotConfigured ? null : (
          <Button
            type="button"
            variant="primary"
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
          >
            {connectMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {connectMutation.isPending ? t("connecting") : t("connect")}
          </Button>
        )}
      </div>

      {connectError && connectError.kind !== "not_configured" && (
        <p className="text-xs text-accent-rose sm:basis-full" role="alert">
          {connectError.kind === "provider_conflict"
            ? connectError.detail
            : connectError.detail}
        </p>
      )}

      {actionError && (
        <p className="text-xs text-accent-rose sm:basis-full" role="alert">
          {actionError}
        </p>
      )}
    </div>
  );
}
