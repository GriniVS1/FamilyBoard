"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/shared/dialog";
import { Input } from "@/components/shared/input";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { InlineKeyboardPanel } from "@/components/setup/inline-keyboard-panel";
import { cn } from "@/lib/utils";
import type { CalendarMember } from "@/components/calendar/types";

type Stage = "pick" | "code";

type PairCodeResponse = {
  code: string;
  expiresAt: string;
};

type PairDeviceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: CalendarMember[];
};

export function PairDeviceDialog({
  open,
  onOpenChange,
  members,
}: PairDeviceDialogProps) {
  const t = useTranslations("settings.devices");
  const tCommon = useTranslations("common");

  const [stage, setStage] = useState<Stage>("pick");
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    members[0]?.id ?? "",
  );
  const [pin, setPin] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [pinFocused, setPinFocused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open) {
      setStage("pick");
      setSelectedMemberId(members[0]?.id ?? "");
      setPin("");
      setGenerating(false);
      setError(null);
      setCode(null);
      setExpiresAt(null);
      setSecondsLeft(0);
      setCopied(false);
      setPinFocused(false);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [open, members]);

  useEffect(() => {
    if (!expiresAt) return;

    function tick() {
      if (!expiresAt) return;
      const diff = Math.max(
        0,
        Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(diff);
    }

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [expiresAt]);

  async function handleGenerate() {
    if (!selectedMemberId || pin.length !== 6) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/pair-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: selectedMemberId, pin }),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setError(t("wrongPin"));
        } else {
          let msg = "";
          try {
            const data = (await res.json()) as { error?: { message?: string } };
            msg = data?.error?.message ?? "";
          } catch {
            // ignore
          }
          setError(msg || t("wrongPin"));
        }
        return;
      }
      const data = (await res.json()) as PairCodeResponse;
      setCode(data.code);
      setExpiresAt(new Date(data.expiresAt));
      setStage("code");
    } catch {
      setError(t("wrongPin"));
    } finally {
      setGenerating(false);
    }
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
  }

  const isExpired = secondsLeft === 0 && stage === "code";

  const displayCode = code
    ? `${code.slice(0, 3)}-${code.slice(3)}`
    : null;

  const qrValue =
    code && typeof window !== "undefined"
      ? `familyboard://pair?url=${window.location.origin}&code=${code}`
      : "";

  async function handleCopy() {
    if (!displayCode) return;
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silent fail
    }
  }

  function handleGoBack() {
    setStage("pick");
    setCode(null);
    setExpiresAt(null);
    setSecondsLeft(0);
    setPin("");
    setError(null);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <div className="overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {stage === "pick" ? (
              <motion.div
                key="pick"
                initial={{ x: 0, opacity: 1 }}
                exit={{ x: "-100%", opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-5"
              >
                <div className="pr-10">
                  <DialogTitle>{t("pairNew")}</DialogTitle>
                  <p className="mt-1 text-sm text-muted">{t("description")}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    {t("member")}
                  </p>
                  <div className="flex flex-col gap-2">
                    {members.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMemberId(m.id)}
                        aria-pressed={selectedMemberId === m.id}
                        className={cn(
                          "flex min-h-12 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors tap-target",
                          selectedMemberId === m.id
                            ? "border-ink bg-ink/5"
                            : "border-border bg-surface hover:bg-bg",
                        )}
                      >
                        <MemberAvatar
                          name={m.name}
                          color={m.color}
                          emoji={m.emoji}
                          className="size-8 shrink-0"
                        />
                        <span className="text-sm font-medium text-ink">
                          {m.name}
                        </span>
                        {selectedMemberId === m.id && (
                          <Check className="ml-auto size-4 shrink-0 text-ink" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="pair-admin-pin"
                    className="text-xs font-semibold uppercase tracking-wider text-muted"
                  >
                    {t("adminPin")}
                  </label>
                  <Input
                    id="pair-admin-pin"
                    type="password"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    value={pin}
                    onChange={(e) =>
                      setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    onFocus={() => setPinFocused(true)}
                    onBlur={() => setPinFocused(false)}
                    maxLength={6}
                    placeholder="••••"
                    className="tabular-nums"
                  />
                  <InlineKeyboardPanel
                    open={pinFocused}
                    value={pin}
                    onChange={(v) => setPin(v.replace(/\D/g, "").slice(0, 6))}
                    defaultLayer="symbols"
                    showAccents={false}
                  />
                </div>

                {error && (
                  <p role="alert" className="text-sm text-accent-rose">
                    {error}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleOpenChange(false)}
                    disabled={generating}
                  >
                    {tCommon("cancel")}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleGenerate}
                    disabled={
                      generating || !selectedMemberId || pin.length !== 6
                    }
                  >
                    {generating && <Loader2 className="size-4 animate-spin" />}
                    {generating ? t("generating") : t("generateCode")}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="code"
                initial={{ x: "100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-5"
              >
                <div className="pr-10">
                  <DialogTitle>{t("scanWith")}</DialogTitle>
                  <p className="mt-1 text-sm text-muted">
                    {t("scanInstructions")}
                  </p>
                </div>

                {isExpired ? (
                  <div className="flex flex-col items-center gap-4 py-4">
                    <p className="text-base font-medium text-accent-rose">
                      {t("expired")}
                    </p>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleGoBack}
                    >
                      {t("generateNew")}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-center">
                      <div className="rounded-2xl border border-border bg-surface p-4">
                        <QRCodeSVG
                          value={qrValue}
                          size={200}
                          bgColor="transparent"
                          fgColor="currentColor"
                          className="text-ink"
                          level="M"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-center text-xs text-muted">
                        {t("codeOnly")}
                      </p>
                      <div className="flex items-center justify-center gap-3">
                        <span className="font-display text-4xl tabular-nums tracking-widest text-ink">
                          {displayCode}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopy}
                          aria-label={t("copyCode")}
                          className="inline-flex size-12 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors hover:bg-bg hover:text-ink tap-target"
                        >
                          {copied ? (
                            <Check className="size-4 text-accent-mint" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                        </button>
                      </div>
                      {copied && (
                        <p
                          role="status"
                          className="text-center text-xs text-accent-mint"
                        >
                          {t("copied")}
                        </p>
                      )}
                    </div>

                    <p className="text-center text-sm tabular-nums text-muted">
                      {t("expiresIn", { seconds: secondsLeft })}
                    </p>
                  </>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  {!isExpired && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleGoBack}
                    >
                      {tCommon("back")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => handleOpenChange(false)}
                  >
                    {tCommon("done")}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
