"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Delete, Loader2, Lock, Smartphone, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";
import { MemberAvatar } from "@/components/shared/member-avatar";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/shared/dialog";
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

const PIN_LENGTH = 6;

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

type RevokeStep = "confirm" | "pin";

export function DevicesRow({ members }: DevicesRowProps) {
  const t = useTranslations("settings.devices");
  const queryClient = useQueryClient();
  const [pairOpen, setPairOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<PairedDevice | null>(null);
  const [revokeStep, setRevokeStep] = useState<RevokeStep>("confirm");
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["devices"],
    queryFn: fetchDevices,
  });

  const revokeMutation = useMutation({
    mutationFn: ({ id, pin }: { id: string; pin: string }) =>
      revokeDevice(id, pin),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
      setRevokeTarget(null);
      setRevokeError(null);
    },
    onError: (err) => {
      const code = err instanceof Error ? err.message : "";
      setRevokeError(
        code === "INVALID_PIN" || code === "UNAUTHORIZED"
          ? t("wrongPin")
          : t("revokeFailed"),
      );
    },
  });

  function openRevokeConfirm(device: PairedDevice) {
    setRevokeTarget(device);
    setRevokeStep("confirm");
    setRevokeError(null);
  }

  function closeRevokeDialog() {
    if (revokeMutation.isPending) return;
    setRevokeTarget(null);
    setRevokeError(null);
  }

  function handleConfirmProceed() {
    setRevokeStep("pin");
    setRevokeError(null);
  }

  function handlePinSubmit(pin: string) {
    if (!revokeTarget) return;
    setRevokeError(null);
    revokeMutation.mutate({ id: revokeTarget.id, pin });
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
                revoking={revokeMutation.isPending && revokeTarget?.id === device.id}
                onRevoke={() => openRevokeConfirm(device)}
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

      <Dialog
        open={revokeTarget !== null}
        onOpenChange={(open) => { if (!open) closeRevokeDialog(); }}
      >
        <DialogContent showClose={!revokeMutation.isPending}>
          {revokeStep === "confirm" && revokeTarget && (
            <ConfirmStep
              device={revokeTarget}
              onConfirm={handleConfirmProceed}
              onCancel={closeRevokeDialog}
            />
          )}
          {revokeStep === "pin" && (
            <PinStep
              onSubmit={handlePinSubmit}
              isPending={revokeMutation.isPending}
              error={revokeError}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

type ConfirmStepProps = {
  device: PairedDevice;
  onConfirm: () => void;
  onCancel: () => void;
};

function ConfirmStep({ device, onConfirm, onCancel }: ConfirmStepProps) {
  const t = useTranslations("settings.devices");
  const tCommon = useTranslations("common");

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1 pr-8">
        <DialogTitle>{t("revokeConfirmTitle")}</DialogTitle>
        <DialogDescription>
          {t("revokeConfirmBody", { name: device.name })}
        </DialogDescription>
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {tCommon("cancel")}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={onConfirm}
          className="bg-accent-rose text-bg hover:bg-accent-rose/90"
        >
          {t("revoke")}
        </Button>
      </div>
    </div>
  );
}

type PinStepProps = {
  onSubmit: (pin: string) => void;
  isPending: boolean;
  error: string | null;
};

function PinStep({ onSubmit, isPending, error }: PinStepProps) {
  const t = useTranslations("settings.devices");
  const [pin, setPin] = useState("");

  const keys: (string | "backspace" | null)[] = [
    "1", "2", "3",
    "4", "5", "6",
    "7", "8", "9",
    null, "0", "backspace",
  ];

  function press(value: string) {
    if (isPending) return;
    setPin((prev) => {
      if (prev.length >= PIN_LENGTH) return prev;
      const next = prev + value;
      if (next.length === PIN_LENGTH) {
        onSubmit(next);
      }
      return next;
    });
  }

  function backspace() {
    if (isPending) return;
    setPin((prev) => prev.slice(0, -1));
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <span
        aria-hidden
        className="inline-flex size-14 items-center justify-center rounded-full bg-accent-sun/30 text-ink"
      >
        <Lock className="size-6" />
      </span>

      <div className="space-y-1 text-center">
        <DialogTitle>{t("revokePinTitle")}</DialogTitle>
      </div>

      <div className="flex justify-center gap-3">
        {Array.from({ length: PIN_LENGTH }).map((_, idx) => {
          const filled = idx < pin.length;
          return (
            <motion.div
              key={idx}
              animate={{ scale: filled ? 1 : 0.85 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className={cn(
                "size-4 rounded-full transition-colors",
                filled ? "bg-ink" : "bg-border",
              )}
            />
          );
        })}
      </div>

      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        {keys.map((key, idx) => {
          if (key === null) {
            return <div key={`empty-${idx}`} aria-hidden />;
          }
          if (key === "backspace") {
            return (
              <motion.button
                key="backspace"
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={backspace}
                disabled={isPending}
                aria-label="Delete"
                className={cn(
                  "tap-target h-14 rounded-2xl bg-bg hover:bg-border/60 text-ink",
                  "flex items-center justify-center transition-colors",
                  "disabled:opacity-50",
                )}
              >
                <Delete className="size-5" />
              </motion.button>
            );
          }
          return (
            <motion.button
              key={key}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => press(key)}
              disabled={isPending}
              className={cn(
                "tap-target h-14 rounded-2xl bg-bg hover:bg-border/60 text-ink",
                "font-display text-2xl tabular",
                "transition-colors disabled:opacity-50",
              )}
            >
              {key}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center text-sm text-accent-rose"
            role="alert"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {isPending && (
        <Loader2 className="size-5 animate-spin text-muted" />
      )}
    </div>
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
