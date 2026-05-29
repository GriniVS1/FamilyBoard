"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/components/shared/button";
import { Input } from "@/components/shared/input";
import { Logo } from "@/components/shared/logo";
import { LicenseActivationError, useActivateLicense, useLicense } from "./use-license";

function mapErrorCode(code: string, t: ReturnType<typeof useTranslations>): string {
  if (code === "LICENSE_DEVICE_MISMATCH") return t("errorDeviceMismatch");
  if (code === "LICENSE_INVALID") return t("errorInvalid");
  return t("errorGeneric");
}

export function ActivationScreen() {
  const t = useTranslations("license");
  const { data: license } = useLicense();
  const { mutate: activate, isPending } = useActivateLicense();

  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const deviceId = license?.deviceId ?? "…";

  function handleCopy() {
    const p = navigator.clipboard?.writeText?.(deviceId);
    if (!p) return; // no clipboard API on plain-HTTP LAN — raw id is shown with select-all as fallback
    void p.then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) {
      setError(t("errorInvalid"));
      inputRef.current?.focus();
      return;
    }
    setError(null);
    activate(trimmed, {
      onError: (err) => {
        const code = err instanceof LicenseActivationError ? err.code : "UNKNOWN";
        setError(mapErrorCode(code, t));
      },
    });
  }

  return (
    <div className="min-h-dvh bg-bg flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg flex flex-col gap-8"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <Logo size={36} />
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-bold text-ink">
              {t("activateTitle")}
            </h1>
            <p className="text-muted text-base max-w-sm mx-auto">
              {t("activateIntro")}
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-surface shadow-soft p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-ink">
                {t("deviceIdLabel")}
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:bg-bg hover:text-ink transition-colors min-h-[36px]"
                aria-label={t("copyDeviceId")}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {copied ? (
                    <motion.span
                      key="check"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-1.5 text-accent-mint"
                    >
                      <Check className="size-3.5" />
                      {t("copied")}
                    </motion.span>
                  ) : (
                    <motion.span
                      key="copy"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-1.5"
                    >
                      <Copy className="size-3.5" />
                      {t("copyDeviceId")}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
            <div className="rounded-2xl border border-border bg-bg px-4 py-3 font-mono text-sm text-ink break-all select-all">
              {deviceId}
            </div>
            <p className="text-xs text-muted">{t("deviceIdHelp")}</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="license-key" className="text-sm font-medium text-ink">
                {t("keyLabel")}
              </label>
              <Input
                id="license-key"
                ref={inputRef}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={t("keyPlaceholder")}
                className="font-mono text-base"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={isPending}
                aria-describedby={error ? "license-error" : undefined}
              />
              <AnimatePresence>
                {error && (
                  <motion.p
                    id="license-error"
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="text-sm text-accent-rose"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isPending || !key.trim()}
              className="w-full"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  {t("activating")}
                </>
              ) : (
                <>
                  <KeyRound className="size-5" />
                  {t("activateButton")}
                </>
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
