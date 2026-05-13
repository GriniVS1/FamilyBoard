"use client";

import { motion } from "framer-motion";
import { Delete } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/shared/dialog";
import { cn } from "@/lib/utils";
import { postJson } from "@/components/setup/types";

const PIN_LENGTH = 6;

type Phase = "current" | "new" | "confirm";

type PinChangeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PinChangeDialog({ open, onOpenChange }: PinChangeDialogProps) {
  const t = useTranslations("settings.pin");
  const [phase, setPhase] = useState<Phase>("current");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setPhase("current");
      setCurrentPin("");
      setNewPin("");
      setPin("");
      setError(null);
      setSuccess(false);
    }
  }, [open]);

  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return;

    if (phase === "current") {
      setCurrentPin(pin);
      setPin("");
      setPhase("new");
      return;
    }
    if (phase === "new") {
      setNewPin(pin);
      setPin("");
      setPhase("confirm");
      return;
    }
    if (phase === "confirm") {
      if (pin !== newPin) {
        setError(t("mismatch"));
        setNewPin("");
        setPin("");
        setPhase("new");
        return;
      }

      setSubmitting(true);
      setError(null);
      postJson<{ ok: true }>("/api/settings/pin/change", {
        currentPin,
        newPin: pin,
      })
        .then(() => {
          setSuccess(true);
          window.setTimeout(() => onOpenChange(false), 800);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : t("couldNotChange"));
          setPhase("current");
          setCurrentPin("");
          setNewPin("");
          setPin("");
        })
        .finally(() => setSubmitting(false));
    }
  }, [pin, phase, currentPin, newPin, onOpenChange, t]);

  function press(value: string) {
    if (submitting || success) return;
    setError(null);
    setPin((prev) => (prev.length < PIN_LENGTH ? prev + value : prev));
  }

  function backspace() {
    if (submitting || success) return;
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  }

  const heading =
    phase === "current"
      ? t("current")
      : phase === "new"
        ? t("new")
        : t("confirm");

  const subheading =
    phase === "current"
      ? t("currentSub")
      : phase === "new"
        ? t("newSub")
        : t("confirmSub");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="flex flex-col gap-5">
          <DialogTitle>{t("changeTitle")}</DialogTitle>
          <div className="space-y-1 text-center">
            <p className="text-base font-medium text-ink">{heading}</p>
            <p className="text-xs text-muted">{subheading}</p>
          </div>

          <div className="flex justify-center gap-3">
            {Array.from({ length: PIN_LENGTH }).map((_, idx) => {
              const filled = idx < pin.length;
              return (
                <motion.div
                  key={idx}
                  animate={{ scale: filled ? 1 : 0.85 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  className={cn(
                    "size-4 rounded-full transition-colors",
                    filled ? "bg-ink" : "bg-border",
                  )}
                />
              );
            })}
          </div>

          <Keypad onPress={press} onBackspace={backspace} disabled={submitting} />

          {error && (
            <p role="alert" className="text-center text-sm text-accent-rose">
              {error}
            </p>
          )}
          {success && (
            <p
              role="status"
              className="text-center text-sm text-accent-mint"
            >
              {t("saved")}
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

type KeypadProps = {
  onPress: (value: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
};

function Keypad({ onPress, onBackspace, disabled }: KeypadProps) {
  const keys: (string | "backspace" | null)[] = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    null,
    "0",
    "backspace",
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {keys.map((key, idx) => {
        if (key === null) {
          return <div key={`empty-${idx}`} aria-hidden />;
        }
        if (key === "backspace") {
          return (
            <motion.button
              key="backspace"
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={onBackspace}
              disabled={disabled}
              aria-label="Delete"
              className={cn(
                "h-14 rounded-2xl bg-bg hover:bg-border/60 text-ink",
                "flex items-center justify-center transition-colors",
                "tap-target disabled:opacity-50",
              )}
            >
              <Delete className="size-5" />
            </motion.button>
          );
        }
        return (
          <motion.button
            key={key}
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => onPress(key)}
            disabled={disabled}
            className={cn(
              "h-14 rounded-2xl bg-bg hover:bg-border/60 text-ink",
              "font-display text-2xl tabular tap-target",
              "transition-colors disabled:opacity-50",
            )}
          >
            {key}
          </motion.button>
        );
      })}
    </div>
  );
}
