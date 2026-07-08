"use client";

import { useTranslations } from "next-intl";
import { SystemActionOverlay } from "./system-action-overlay";

export function ShutdownOverlay() {
  const t = useTranslations("settings.shutdown");
  return <SystemActionOverlay text={t("shuttingDown")} />;
}
