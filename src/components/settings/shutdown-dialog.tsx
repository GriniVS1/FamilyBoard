"use client";

import { Power } from "lucide-react";
import { useTranslations } from "next-intl";
import { SystemActionDialog } from "./system-action-dialog";

type ShutdownDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmed: () => void;
};

export function ShutdownDialog({ open, onOpenChange, onConfirmed }: ShutdownDialogProps) {
  const t = useTranslations("settings.shutdown");

  return (
    <SystemActionDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirmed={onConfirmed}
      endpoint="/api/system/shutdown"
      icon={Power}
      iconClassName="bg-accent-peach/30 text-ink"
      strings={{
        confirmTitle: t("confirmTitle"),
        description: t("description"),
        adminPin: t("adminPin"),
        cancel: t("cancel"),
        wrongPin: t("wrongPin"),
        tooManyAttempts: t("tooManyAttempts"),
        hostUnavailable: t("hostUnavailable"),
        failed: t("failed"),
      }}
    />
  );
}
