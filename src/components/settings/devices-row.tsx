"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Smartphone, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { cn, isMemberColor, type MemberColor } from "@/lib/utils";
import { PairDeviceDialog } from "./pair-device-dialog";
import type { CalendarMember } from "@/components/calendar/types";

type PairedDevice = {
  id: string;
  name: string;
  platform: "ios" | "android" | "unknown";
  memberId: string;
  memberName: string;
  memberColor: string;
  memberEmoji: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  revokedAt: string | null;
};

type DevicesResponse = {
  devices: PairedDevice[];
};

const ACCENT_TINT: Record<MemberColor, string> = {
  peach: "bg-accent-peach/30",
  mint: "bg-accent-mint/30",
  sun: "bg-accent-sun/30",
  sky: "bg-accent-sky/30",
  lilac: "bg-accent-lilac/30",
  rose: "bg-accent-rose/30",
  teal: "bg-accent-teal/30",
  sand: "bg-accent-sand/30",
};

type DevicesRowProps = {
  members: CalendarMember[];
};

async function fetchDevices(): Promise<DevicesResponse> {
  const res = await fetch("/api/devices", { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load devices (${res.status})`);
  return (await res.json()) as DevicesResponse;
}

async function revokeDevice(id: string, pin: string): Promise<void> {
  const res = await fetch(`/api/devices/${id}`, {
    method: "DELETE",
    headers: { "X-Admin-Pin": pin },
  });
  if (!res.ok) {
    let code: string | undefined;
    try {
      const body = (await res.json()) as { error?: { code?: string } };
      code = body?.error?.code;
    } catch {
      // body wasn't JSON
    }
    throw new Error(code ?? `Revoke failed (${res.status})`);
  }
}

export function DevicesRow({ members }: DevicesRowProps) {
  const t = useTranslations("settings.devices");
  const queryClient = useQueryClient();
  const [pairOpen, setPairOpen] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["devices"],
    queryFn: fetchDevices,
  });

  const [revokeError, setRevokeError] = useState<string | null>(null);

  const revokeMutation = useMutation({
    mutationFn: ({ id, pin }: { id: string; pin: string }) =>
      revokeDevice(id, pin),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
      setRevokingId(null);
      setRevokeError(null);
    },
    onError: (err) => {
      setRevokingId(null);
      const code = err instanceof Error ? err.message : "";
      setRevokeError(
        code === "INVALID_PIN" || code === "UNAUTHORIZED"
          ? t("wrongPin")
          : t("revokeFailed"),
      );
    },
  });

  function handleRevoke(device: PairedDevice) {
    if (!window.confirm(t("revokeConfirm", { name: device.name }))) return;
    const pin = window.prompt(t("adminPinPrompt"));
    if (pin === null) return;
    if (pin.trim().length < 4) {
      setRevokeError(t("wrongPin"));
      return;
    }
    setRevokeError(null);
    setRevokingId(device.id);
    revokeMutation.mutate({ id: device.id, pin: pin.trim() });
  }

  function handlePairClose(open: boolean) {
    setPairOpen(open);
    if (!open) {
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
    }
  }

  const activeDevices =
    data?.devices.filter((d) => d.revokedAt === null) ?? [];

  return (
    <>
      <GlassCard className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="font-display text-xl text-ink">{t("title")}</h2>
            <p className="text-sm text-muted">{t("description")}</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPairOpen(true)}
            className="shrink-0"
          >
            <Smartphone className="size-4" />
            <span className="hidden sm:inline">{t("pairNew")}</span>
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" />
          </div>
        )}

        {isError && (
          <p className="text-sm text-accent-rose" role="alert">
            {t("empty")}
          </p>
        )}

        {revokeError && (
          <p className="text-sm text-accent-rose" role="alert">
            {revokeError}
          </p>
        )}

        {!isLoading && !isError && activeDevices.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-8 text-center">
            <Smartphone className="size-8 text-muted" aria-hidden />
            <p className="text-sm text-muted">{t("empty")}</p>
            <Button
              type="button"
              variant="primary"
              onClick={() => setPairOpen(true)}
            >
              {t("pairNew")}
            </Button>
          </div>
        )}

        {!isLoading && !isError && activeDevices.length > 0 && (
          <ul className="flex flex-col gap-3">
            {activeDevices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                revoking={revokingId === device.id}
                onRevoke={() => handleRevoke(device)}
              />
            ))}
          </ul>
        )}
      </GlassCard>

      <PairDeviceDialog
        open={pairOpen}
        onOpenChange={handlePairClose}
        members={members}
      />
    </>
  );
}

type DeviceCardProps = {
  device: PairedDevice;
  revoking: boolean;
  onRevoke: () => void;
};

function DeviceCard({ device, revoking, onRevoke }: DeviceCardProps) {
  const t = useTranslations("settings.devices");
  const safeColor: MemberColor = isMemberColor(device.memberColor)
    ? device.memberColor
    : "sand";

  const lastSeenLabel = device.lastSeenAt
    ? formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true })
    : t("never");

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between",
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          aria-hidden
          className={cn(
            "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-ink",
            ACCENT_TINT[safeColor],
          )}
        >
          <Smartphone className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-ink truncate">
              {device.name}
            </span>
            <PlatformPill platform={device.platform} />
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <MemberPill
              name={device.memberName}
              color={device.memberColor}
              emoji={device.memberEmoji}
            />
            <span className="text-xs tabular-nums text-muted">
              {t("lastSeen", { when: lastSeenLabel })}
            </span>
          </div>
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={onRevoke}
        disabled={revoking}
        className="shrink-0 text-accent-rose hover:bg-accent-rose/10"
        aria-label={t("revoke")}
      >
        {revoking ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
        <span className="hidden sm:inline">{t("revoke")}</span>
      </Button>
    </li>
  );
}

type PlatformPillProps = {
  platform: "ios" | "android" | "unknown";
};

function PlatformPill({ platform }: PlatformPillProps) {
  const t = useTranslations("settings.devices.platforms");
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-bg px-2 py-0.5 text-xs text-muted">
      {t(platform)}
    </span>
  );
}

type MemberPillProps = {
  name: string;
  color: string;
  emoji: string | null;
};

function MemberPill({ name, color, emoji }: MemberPillProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <MemberAvatar name={name} color={color} emoji={emoji} className="size-4" />
      <span className="text-xs text-muted">{name}</span>
    </span>
  );
}
