"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shared/button";

type BannerState =
  | { kind: "connected" }
  | { kind: "error"; reason: string }
  | null;

function resolveErrorReason(
  raw: string | null,
  t: (key: string) => string,
): string {
  switch (raw) {
    case "auth_failed":
      return t("errorReasons.authFailed");
    case "expired":
      return t("errorReasons.expired");
    case "denied":
      return t("errorReasons.denied");
    default:
      return raw ?? t("errorReasons.generic");
  }
}

export function MicrosoftCallbackBanner() {
  const t = useTranslations("settings.microsoft");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [banner, setBanner] = useState<BannerState>(null);

  const clearedRef = useRef(false);

  useEffect(() => {
    if (clearedRef.current) return;

    const microsoft = searchParams.get("microsoft");
    if (!microsoft) return;

    clearedRef.current = true;

    if (microsoft === "connected") {
      setBanner({ kind: "connected" });
    } else if (microsoft === "error") {
      const rawReason = searchParams.get("reason");
      setBanner({ kind: "error", reason: resolveErrorReason(rawReason, t) });
    }

    router.replace("/settings");
  }, [searchParams, router, t]);

  useEffect(() => {
    if (banner?.kind !== "connected") return;
    const timer = window.setTimeout(() => setBanner(null), 6000);
    return () => window.clearTimeout(timer);
  }, [banner]);

  return (
    <AnimatePresence>
      {banner && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          role="status"
          className={
            banner.kind === "connected"
              ? "rounded-2xl border border-accent-mint/40 bg-accent-mint/15 px-4 py-3 flex items-center gap-3"
              : "rounded-2xl border border-accent-rose/40 bg-accent-rose/15 px-4 py-3 flex items-center gap-3"
          }
        >
          {banner.kind === "connected" ? (
            <CheckCircle2 className="size-5 shrink-0 text-accent-mint" />
          ) : (
            <X className="size-5 shrink-0 text-accent-rose" />
          )}
          <div className="flex-1 text-sm text-ink">
            {banner.kind === "connected"
              ? t("callback.connected")
              : t("callback.error", { reason: banner.reason })}
          </div>
          {banner.kind === "error" && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setBanner(null);
              }}
              className="text-sm text-accent-rose hover:bg-accent-rose/10 shrink-0"
            >
              {t("callback.retry")}
            </Button>
          )}
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="size-9 rounded-full text-muted hover:bg-bg/60 hover:text-ink inline-flex items-center justify-center shrink-0"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
