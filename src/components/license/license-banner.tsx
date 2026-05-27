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
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("license-grace-dismissed") === "1";
    } catch {
      return false;
    }
  });

  function dismiss() {
    try {
      sessionStorage.setItem("license-grace-dismissed", "1");
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
          className="flex items-center gap-3 border-b border-accent-sun/40 bg-accent-sun/15 px-4 py-3"
        >
          <KeyRound className="size-4 shrink-0 text-ink" aria-hidden />
          <span className="flex-1 text-sm text-ink">
            {t("graceBanner", { days })}
          </span>
          <button
            type="button"
            onClick={onActivate}
            className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-ink underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 min-h-[36px]"
          >
            {t("activateButton")} &rarr;
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-bg/60 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
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
      className="flex items-center gap-3 border-b border-accent-rose/40 bg-accent-rose/15 px-4 py-3"
    >
      <AlertTriangle className="size-4 shrink-0 text-accent-rose" aria-hidden />
      <span className="flex-1 text-sm text-ink">{t("softBanner")}</span>
      <button
        type="button"
        onClick={onActivate}
        className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-accent-rose underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-rose/30 min-h-[36px]"
      >
        {t("activateButton")} &rarr;
      </button>
    </div>
  );
}

export function LicenseBanner() {
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
            {"FamilyBoard aktivieren"}
          </DialogTitle>
          <div className="max-h-[85dvh] overflow-y-auto">
            <ActivationScreen />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
