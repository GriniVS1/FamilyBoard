"use client";

import { format, parseISO } from "date-fns";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/shared/dialog";
import { ActivationScreen } from "./activation-screen";
import { useLicense } from "./use-license";

export function LicenseSettingsCard() {
  const t = useTranslations("license");
  const { data: license } = useLicense();
  const [activateOpen, setActivateOpen] = useState(false);

  if (!license) return null;

  const statusColor =
    license.gate === "active"
      ? "text-accent-mint"
      : license.gate === "grace"
        ? "text-accent-sun"
        : "text-accent-rose";

  const validUntilLabel = license.validUntil
    ? format(parseISO(license.validUntil), "PP")
    : null;

  return (
    <>
      <GlassCard className="flex flex-col gap-4 p-6">
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-sky/30 text-ink"
          >
            <ShieldCheck className="size-4" />
          </span>
          <div className="flex-1 space-y-1">
            <h2 className="font-display text-xl text-ink">
              {t("settingsCardTitle")}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-bg/40 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">
              {t("statusLabel")}
            </div>
            <div className={`text-sm font-medium ${statusColor}`}>
              {license.status}
            </div>
          </div>

          {license.plan && (
            <div className="rounded-2xl border border-border bg-bg/40 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                {t("planLabel")}
              </div>
              <div className="text-sm font-medium text-ink">{license.plan}</div>
            </div>
          )}

          {validUntilLabel && (
            <div className="rounded-2xl border border-border bg-bg/40 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                {t("validUntilLabel")}
              </div>
              <div className="text-sm font-medium text-ink">
                {validUntilLabel}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-bg/40 px-4 py-3 sm:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">
              {t("deviceIdLabel")}
            </div>
            <div className="font-mono text-xs text-ink break-all select-all">
              {license.deviceId}
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={() => setActivateOpen(true)}
          className="self-start"
        >
          <KeyRound className="size-4" />
          {t("changeKeyButton")}
        </Button>
      </GlassCard>

      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden" showClose>
          <DialogTitle className="sr-only">
            {t("activateTitle")}
          </DialogTitle>
          <div className="max-h-[85dvh] overflow-y-auto">
            <ActivationScreen />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
