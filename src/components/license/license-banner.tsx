"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, KeyRound, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { differenceInDays, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/shared/dialog";
import { ActivationScreen } from "./activation-screen";
import { useLicense } from "./use-license";

function GraceBanner({
  graceEndsAt,
  onActivate,
}: {
  graceEndsAt: string;
  onActivate: () => void;
}) {
  const t = useTranslations("license");
  const dismissKey = `license-grace-dismissed:${graceEndsAt}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(dismissKey) === "1";
    } catch {
      return false;
    }
  });

  function dismiss() {
    try {
      sessionStorage.setItem(dismissKey, "1");
    } catch {
      // storage may be unavailable
    }
    setDismissed(true);
  }

  const days = Math.max(
    0,
    differenceInDays(parseISO(graceEndsAt), new Date()),
  );

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-2 border-b border-accent-sun/40 bg-accent-sun/15 px-3 py-1 sm:gap-3 sm:px-4"
        >
          <KeyRound className="size-4 shrink-0 text-ink" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm text-ink">
            <span className="sm:hidden">{t("graceBannerShort", { days })}</span>
            <span className="hidden sm:inline">{t("graceBanner", { days })}</span>
          </span>
          <button
            type="button"
            onClick={onActivate}
            className="inline-flex min-h-12 shrink-0 items-center rounded-full px-3 text-sm font-semibold text-ink underline underline-offset-2 hover:no-underline focus-ring-kid"
          >
            {t("activateButton")}<span className="hidden sm:inline"> &rarr;</span>
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full text-muted hover:bg-bg/60 hover:text-ink focus-ring-kid"
            aria-label={t("dismissBanner")}
          >
            <X className="size-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SoftBanner({ onActivate }: { onActivate: () => void }) {
  const t = useTranslations("license");

  return (
    <div
      role="alert"
      className="flex items-center gap-2 border-b border-accent-rose/40 bg-accent-rose/15 px-3 py-1 sm:gap-3 sm:px-4"
    >
      <AlertTriangle className="size-4 shrink-0 text-accent-rose" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-sm text-ink">
        <span className="sm:hidden">{t("softBannerShort")}</span>
        <span className="hidden sm:inline">{t("softBanner")}</span>
      </span>
      <button
        type="button"
        onClick={onActivate}
        className="inline-flex min-h-12 shrink-0 items-center rounded-full px-3 text-sm font-semibold text-accent-rose underline underline-offset-2 hover:no-underline focus-ring-kid"
      >
        {t("activateButton")}<span className="hidden sm:inline"> &rarr;</span>
      </button>
    </div>
  );
}

export function LicenseBanner() {
  const t = useTranslations("license");
  const { data: license } = useLicense();
  const [activateOpen, setActivateOpen] = useState(false);

  if (!license || license.gate === "active" || license.gate === "hard") {
    return null;
  }

  return (
    <>
      {license.gate === "grace" && license.graceEndsAt && (
        <GraceBanner
          graceEndsAt={license.graceEndsAt}
          onActivate={() => setActivateOpen(true)}
        />
      )}
      {license.gate === "soft" && (
        <SoftBanner onActivate={() => setActivateOpen(true)} />
      )}

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
