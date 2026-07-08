"use client";

import { useTranslations } from "next-intl";
import { SystemActionOverlay } from "./system-action-overlay";

export function RebootOverlay() {
  const t = useTranslations("settings.reboot");
  return <SystemActionOverlay text={t("rebooting")} />;
}
