"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Globe,
  Lock,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { CalendarMember } from "@/components/calendar/types";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";
import { LocalePicker } from "@/components/shared/locale-picker";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { DisplaySleepCard } from "./display-sleep-card";
import { FactoryResetDialog } from "./factory-reset-dialog";
import { FamilyEditor } from "./family-editor";
import { CaldavRow } from "./caldav-row";
import { DevicesRow } from "./devices-row";
import { GoogleRow } from "./google-row";
import { MicrosoftCallbackBanner } from "./microsoft-callback-banner";
import { MicrosoftRow } from "./microsoft-row";
import { MemberEditorDialog } from "./member-editor-dialog";
import { NavConfigCard } from "./nav-config-card";
import { NetworkSection } from "./network-section";
import { PinChangeDialog } from "./pin-change-dialog";
import { GateOverlay, PinGate } from "./pin-gate";
import { PushToggle } from "./push-toggle";
import { RebootDialog } from "./reboot-dialog";
import { RebootOverlay } from "./reboot-overlay";
import { ScreensaverIdlePicker } from "./screensaver-idle-picker";
import { ShutdownDialog } from "./shutdown-dialog";
import { ShutdownOverlay } from "./shutdown-overlay";
import { LicenseSettingsCard } from "@/components/license/license-settings-card";
import { UpdatesSettingsCard } from "@/components/settings/updates-settings-card";

type FamilyData = {
  id: string;
  name: string;
  weatherLat?: number | null;
  weatherLon?: number | null;
  weatherLabel: string | null;
};

type SettingsViewProps = {
  family: FamilyData | null;
  members: CalendarMember[];
  oauthBanner: OauthBanner | null;
};

export type OauthBanner = {
  kind: "success" | "error";
  memberId?: string;
  memberName?: string;
  reason?: string;
};

async function jsonRequest<T>(
  url: string,
  method: string,
  adminPin: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: {
      "X-Admin-Pin": adminPin,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      if (data?.error?.message) message = data.error.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export function SettingsView({
  family,
  members,
  oauthBanner,
}: SettingsViewProps) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [unlocked, setUnlocked] = useState(false);
  const [verifiedPin, setVerifiedPin] = useState("");
  const [banner, setBanner] = useState<OauthBanner | null>(oauthBanner);
  const [familyState, setFamilyState] = useState<FamilyData | null>(family);
  const [memberList, setMemberList] = useState<CalendarMember[]>(members);
  const [memberEditing, setMemberEditing] = useState<CalendarMember | null>(null);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [rebootDialogOpen, setRebootDialogOpen] = useState(false);
  const [rebooting, setRebooting] = useState(false);
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);
  const [shuttingDown, setShuttingDown] = useState(false);

  useEffect(() => {
    if (!banner) return;
    const timer = window.setTimeout(() => setBanner(null), 6000);
    return () => window.clearTimeout(timer);
  }, [banner]);

  const familyMutation = useMutation({
    mutationFn: (patch: {
      name?: string;
      weatherLat?: number | null;
      weatherLon?: number | null;
      weatherLabel?: string | null;
    }) => jsonRequest<FamilyData>("/api/settings/family", "PATCH", verifiedPin, patch),
    onSuccess: (data) => {
      setFamilyState(data);
      void queryClient.invalidateQueries({ queryKey: ["weather"] });
    },
  });

  const memberSaveMutation = useMutation({
    mutationFn: (args: {
      id: string;
      patch: {
        name?: string;
        color?: string;
        emoji?: string | null;
        role?: string;
      };
    }) => jsonRequest<CalendarMember>(`/api/members/${args.id}`, "PATCH", verifiedPin, args.patch),
    onSuccess: (data) => {
      setMemberList((prev) =>
        prev.map((m) => (m.id === data.id ? data : m)),
      );
    },
  });

  const memberDeleteMutation = useMutation({
    mutationFn: (id: string) =>
      jsonRequest<{ ok: true }>(`/api/members/${id}`, "DELETE", verifiedPin),
    onSuccess: (_data, id) => {
      setMemberList((prev) => prev.filter((m) => m.id !== id));
    },
  });

  const memberAddMutation = useMutation({
    mutationFn: (input: {
      name: string;
      color: string;
      emoji?: string | null;
      role?: string;
    }) => jsonRequest<CalendarMember>("/api/members", "POST", verifiedPin, input),
    onSuccess: (data) => {
      setMemberList((prev) => [...prev, data]);
    },
  });

  function openMemberEdit(m: CalendarMember) {
    setMemberEditing(m);
    setMemberDialogOpen(true);
  }

  function openMemberAdd() {
    setMemberEditing(null);
    setMemberDialogOpen(true);
  }

  const MAX_MEMBERS = 8;
  const canAddMember = memberList.length < MAX_MEMBERS;

  function bannerMessage(): string {
    if (!banner) return "";
    if (banner.kind === "success") {
      return banner.memberName
        ? t("googleConnectedFor", { name: banner.memberName })
        : t("googleConnected");
    }
    return banner.reason
      ? t("googleFailed", { reason: banner.reason })
      : t("googleFailedNoReason");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Suspense>
        <MicrosoftCallbackBanner />
      </Suspense>

      <AnimatePresence>
        {banner && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            role="status"
            className={
              banner.kind === "success"
                ? "rounded-2xl border border-accent-mint/40 bg-accent-mint/15 px-4 py-3 flex items-center gap-3"
                : "rounded-2xl border border-accent-rose/40 bg-accent-rose/15 px-4 py-3 flex items-center gap-3"
            }
          >
            {banner.kind === "success" ? (
              <CheckCircle2 className="size-5 text-accent-mint" />
            ) : (
              <X className="size-5 text-accent-rose" />
            )}
            <div className="flex-1 text-sm text-ink">
              {bannerMessage()}
            </div>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="size-9 rounded-full text-muted hover:bg-bg/60 hover:text-ink inline-flex items-center justify-center"
              aria-label={t("dismiss")}
            >
              <X className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!unlocked ? (
        <PinGate
          onUnlock={() => setUnlocked(true)}
          onUnlockWithPin={(pin) => setVerifiedPin(pin)}
          title={t("enterPin")}
          description={t("pinProtected")}
        />
      ) : (
        <span
          role="status"
          className="inline-flex w-fit items-center gap-2 rounded-full bg-accent-mint/30 px-3 py-1 text-xs font-medium text-ink"
        >
          <ShieldCheck className="size-4" />
          {t("unlocked")}
        </span>
      )}

      <GateOverlay locked={!unlocked}>
        <PushToggle />
      </GateOverlay>

      <GateOverlay locked={!unlocked}>
        <GlassCard className="flex flex-col gap-4 p-6">
          <div className="space-y-1">
            <h2 className="font-display text-xl text-ink">{t("language")}</h2>
            <p className="text-sm text-muted">{t("languageDescription")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-muted" />
            <LocalePicker adminPin={verifiedPin} />
          </div>
        </GlassCard>
      </GateOverlay>

      <GateOverlay locked={!unlocked}>
        <ScreensaverIdlePicker adminPin={verifiedPin} />
      </GateOverlay>

      <GateOverlay locked={!unlocked}>
        <DisplaySleepCard adminPin={verifiedPin} />
      </GateOverlay>

      <GateOverlay locked={!unlocked}>
        <NavConfigCard adminPin={verifiedPin} />
      </GateOverlay>

      <GateOverlay locked={!unlocked}>
        <DevicesRow members={memberList} />
      </GateOverlay>

      <GateOverlay locked={!unlocked}>
        <FamilyEditor
          family={familyState}
          disabled={!unlocked}
          onUpdate={async (patch) => {
            return await familyMutation.mutateAsync(patch);
          }}
        />
      </GateOverlay>

      <GateOverlay locked={!unlocked}>
        <GlassCard className="flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="font-display text-xl text-ink">{t("members.title")}</h2>
              <p className="text-sm text-muted">{t("members.description")}</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={openMemberAdd}
              disabled={!unlocked || !canAddMember}
              aria-label={t("members.addMember")}
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">{t("members.addMember")}</span>
            </Button>
          </div>
          {!canAddMember && (
            <p className="text-xs text-muted">
              {t("members.maxReachedHint", { max: MAX_MEMBERS })}
            </p>
          )}

          <p className="rounded-2xl border border-border bg-bg/30 p-3 text-sm text-muted">
            {t("calendarConnectViaApp")}
          </p>

          <ul className="flex flex-col gap-4">
            {memberList.map((m) => (
              <li
                key={m.id}
                className="rounded-3xl border border-border bg-surface p-4 flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <MemberAvatar
                    name={m.name}
                    color={m.color}
                    emoji={m.emoji}
                    className="size-12"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-medium text-ink truncate">
                      {m.name}
                    </div>
                    <span className="inline-flex mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted">
                      {m.role === "ADMIN" ? tCommon("admin") : tCommon("member")}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => openMemberEdit(m)}
                    disabled={!unlocked}
                    aria-label={t("members.editMember", { name: m.name })}
                  >
                    <Pencil className="size-4" />
                    <span className="hidden sm:inline">{tCommon("edit")}</span>
                  </Button>
                </div>
                <GoogleRow member={m} adminPin={verifiedPin} />
                <CaldavRow member={m} adminPin={verifiedPin} />
                <MicrosoftRow member={m} adminPin={verifiedPin} />
              </li>
            ))}
            {memberList.length === 0 && (
              <li className="text-sm text-muted">{t("members.noMembers")}</li>
            )}
          </ul>
        </GlassCard>
      </GateOverlay>

      <GateOverlay locked={!unlocked}>
        <NetworkSection adminPin={verifiedPin} unlocked={unlocked} />
      </GateOverlay>

      <GateOverlay locked={!unlocked}>
        <LicenseSettingsCard />
      </GateOverlay>

      <GateOverlay locked={!unlocked}>
        <UpdatesSettingsCard adminPin={verifiedPin} />
      </GateOverlay>

      <GateOverlay locked={!unlocked}>
        <GlassCard className="flex flex-col gap-4 p-6">
          <div className="space-y-1">
            <h2 className="font-display text-xl text-ink">{t("pin.title")}</h2>
            <p className="text-sm text-muted">
              {t("pin.description")}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="inline-flex size-10 items-center justify-center rounded-full bg-accent-sun/30 text-ink"
              >
                <Lock className="size-4" />
              </span>
              <div>
                <div className="text-sm font-medium text-ink">{t("pin.adminPin")}</div>
                <div className="text-xs text-muted">
                  {t("pin.adminPinDesc")}
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPinDialogOpen(true)}
              disabled={!unlocked}
            >
              {t("pin.change")}
            </Button>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="inline-flex size-10 items-center justify-center rounded-full bg-accent-sky/30 text-ink"
              >
                <RotateCw className="size-4" />
              </span>
              <div>
                <div className="text-sm font-medium text-ink">{t("reboot.title")}</div>
                <div className="text-xs text-muted">
                  {t("reboot.description")}
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRebootDialogOpen(true)}
              disabled={!unlocked}
            >
              {t("reboot.button")}
            </Button>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="inline-flex size-10 items-center justify-center rounded-full bg-accent-peach/30 text-ink"
              >
                <Power className="size-4" />
              </span>
              <div>
                <div className="text-sm font-medium text-ink">{t("shutdown.title")}</div>
                <div className="text-xs text-muted">
                  {t("shutdown.description")}
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShutdownDialogOpen(true)}
              disabled={!unlocked}
            >
              {t("shutdown.button")}
            </Button>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-accent-rose/30 bg-accent-rose/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="inline-flex size-10 items-center justify-center rounded-full bg-accent-rose/30 text-accent-rose"
              >
                <RotateCcw className="size-4" />
              </span>
              <div>
                <div className="text-sm font-medium text-ink">{t("factoryReset.title")}</div>
                <div className="text-xs text-muted">
                  {t("factoryReset.description")}
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setResetDialogOpen(true)}
              disabled={!unlocked}
              className="text-accent-rose hover:bg-accent-rose/20"
            >
              {t("factoryReset.button")}
            </Button>
          </div>
        </GlassCard>
      </GateOverlay>

      <MemberEditorDialog
        open={memberDialogOpen}
        onOpenChange={(o) => {
          setMemberDialogOpen(o);
          if (!o) setMemberEditing(null);
        }}
        member={memberEditing}
        onSave={async (id, patch) => {
          await memberSaveMutation.mutateAsync({ id, patch });
        }}
        onCreate={async (input) => {
          await memberAddMutation.mutateAsync(input);
        }}
        onDelete={async (id) => {
          await memberDeleteMutation.mutateAsync(id);
        }}
      />

      <PinChangeDialog open={pinDialogOpen} onOpenChange={setPinDialogOpen} />
      <FactoryResetDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
      />
      <RebootDialog
        open={rebootDialogOpen}
        onOpenChange={setRebootDialogOpen}
        onConfirmed={() => {
          setRebootDialogOpen(false);
          setRebooting(true);
        }}
      />
      {rebooting && <RebootOverlay />}
      <ShutdownDialog
        open={shutdownDialogOpen}
        onOpenChange={setShutdownDialogOpen}
        onConfirmed={() => {
          setShutdownDialogOpen(false);
          setShuttingDown(true);
        }}
      />
      {shuttingDown && <ShutdownOverlay />}
    </div>
  );
}
