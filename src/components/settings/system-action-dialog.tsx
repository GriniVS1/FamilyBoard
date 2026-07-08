"use client";

import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/shared/dialog";
import { cn } from "@/lib/utils";
import { PinDots, PinKeypad } from "./pin-keypad";

const PIN_LENGTH = 6;

export type SystemActionStrings = {
  confirmTitle: string;
  description: string;
  adminPin: string;
  cancel: string;
  wrongPin: string;
  tooManyAttempts: string;
  hostUnavailable: string;
  failed: string;
};

type SystemActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmed: () => void;
  endpoint: string;
  icon: LucideIcon;
  iconClassName: string;
  strings: SystemActionStrings;
};

// Shared by every dialog that confirms a destructive host action (reboot,
// shutdown) behind the admin PIN — only endpoint/copy/icon differ per caller.
export function SystemActionDialog({
  open,
  onOpenChange,
  onConfirmed,
  endpoint,
  icon: Icon,
  iconClassName,
  strings,
}: SystemActionDialogProps) {
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
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "X-Admin-Pin": candidate },
      });
      if (!res.ok) {
        setPin("");
        setSubmitting(false);
        if (res.status === 403) {
          setError(strings.wrongPin);
        } else if (res.status === 429) {
          setError(strings.tooManyAttempts);
        } else if (res.status === 502) {
          setError(strings.hostUnavailable);
        } else {
          setError(strings.failed);
        }
        return;
      }
      // Leave the dialog + submitting state as-is — the parent swaps in the
      // full-screen overlay immediately, so there's nothing left to reset.
      onConfirmed();
    } catch {
      setPin("");
      setSubmitting(false);
      setError(strings.failed);
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
              className={cn(
                "inline-flex size-12 shrink-0 items-center justify-center rounded-full",
                iconClassName,
              )}
            >
              <Icon className="size-6" />
            </span>
            <div>
              <DialogTitle>{strings.confirmTitle}</DialogTitle>
              <p className="mt-1 text-sm text-muted">{strings.description}</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted">
              {strings.adminPin}
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
              {strings.cancel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
