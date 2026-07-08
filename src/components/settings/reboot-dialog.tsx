"use client";

import { RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/shared/dialog";
import { PinDots, PinKeypad } from "./pin-keypad";

const PIN_LENGTH = 6;

type RebootDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmed: () => void;
};

export function RebootDialog({
  open,
  onOpenChange,
  onConfirmed,
}: RebootDialogProps) {
  const t = useTranslations("settings.reboot");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPin("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  async function submit(candidate: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/system/reboot", {
        method: "POST",
        headers: { "X-Admin-Pin": candidate },
      });
      if (!res.ok) {
        setPin("");
        setSubmitting(false);
        if (res.status === 403) {
          setError(t("wrongPin"));
        } else if (res.status === 429) {
          setError(t("tooManyAttempts"));
        } else if (res.status === 502) {
          setError(t("hostUnavailable"));
        } else {
          setError(t("failed"));
        }
        return;
      }
      // Leave the dialog + submitting state as-is — the parent swaps in the
      // full-screen overlay immediately, so there's nothing left to reset.
      onConfirmed();
    } catch {
      setPin("");
      setSubmitting(false);
      setError(t("failed"));
    }
  }

  function press(value: string) {
    if (submitting) return;
    setError(null);
    setPin((prev) => {
      if (prev.length >= PIN_LENGTH) return prev;
      const next = prev + value;
      if (next.length === PIN_LENGTH) {
        void submit(next);
      }
      return next;
    });
  }

  function backspace() {
    if (submitting) return;
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3 pr-10">
            <span
              aria-hidden
              className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-sky/30 text-ink"
            >
              <RotateCw className="size-6" />
            </span>
            <div>
              <DialogTitle>{t("confirmTitle")}</DialogTitle>
              <p className="mt-1 text-sm text-muted">{t("description")}</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted">
              {t("adminPin")}
            </p>
            <PinDots length={PIN_LENGTH} filled={pin.length} />
          </div>

          <PinKeypad onPress={press} onBackspace={backspace} disabled={submitting} />

          {error && (
            <p role="alert" className="text-center text-sm text-accent-rose">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
