"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Delete } from "lucide-react";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";
import { postJson } from "./types";

const PIN_LENGTH = 4;

type StepPinProps = {
  onComplete: () => void;
  onBack: () => void;
};

type Phase = "enter" | "confirm";

export function StepPin({ onComplete, onBack }: StepPinProps) {
  const [phase, setPhase] = useState<Phase>("enter");
  const [firstPin, setFirstPin] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return;

    if (phase === "enter") {
      setFirstPin(pin);
      setPin("");
      setPhase("confirm");
      return;
    }

    if (phase === "confirm") {
      if (pin !== firstPin) {
        setError("PINs don't match. Try again.");
        setFirstPin("");
        setPin("");
        setPhase("enter");
        return;
      }

      setSubmitting(true);
      setError(null);
      postJson<{ ok: true }>("/api/setup/pin", { pin })
        .then(() => onComplete())
        .catch((err: unknown) => {
          setError(
            err instanceof Error ? err.message : "Something went wrong.",
          );
          setFirstPin("");
          setPin("");
          setPhase("enter");
        })
        .finally(() => setSubmitting(false));
    }
  }, [pin, phase, firstPin, onComplete]);

  function press(value: string) {
    if (submitting) return;
    setError(null);
    setPin((prev) => (prev.length < PIN_LENGTH ? prev + value : prev));
  }

  function backspace() {
    if (submitting) return;
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  }

  const heading = phase === "enter" ? "Set your admin PIN" : "Confirm your PIN";
  const subheading =
    phase === "enter"
      ? "Used to unlock admin actions on the dashboard."
      : "Enter the same 4 digits again.";

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-3">
        <p className="text-muted text-sm font-medium tracking-wide uppercase">
          Step 3
        </p>
        <h2 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05]">
          {heading}
        </h2>
        <p className="text-muted text-lg">{subheading}</p>
      </div>

      <GlassCard className="p-8 sm:p-10 mx-auto w-full max-w-sm">
        <div className="flex justify-center gap-4 mb-8">
          {Array.from({ length: PIN_LENGTH }).map((_, idx) => {
            const filled = idx < pin.length;
            return (
              <motion.div
                key={idx}
                animate={{ scale: filled ? 1 : 0.85 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                className={cn(
                  "size-5 rounded-full transition-colors",
                  filled ? "bg-ink" : "bg-border",
                )}
              />
            );
          })}
        </div>

        <Keypad onPress={press} onBackspace={backspace} disabled={submitting} />
      </GlassCard>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center text-sm text-accent-rose"
            role="alert"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex justify-between gap-3">
        <Button type="button" variant="ghost" size="lg" onClick={onBack}>
          Back
        </Button>
        {phase === "confirm" && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => {
              setFirstPin("");
              setPin("");
              setPhase("enter");
              setError(null);
            }}
          >
            Restart
          </Button>
        )}
      </div>
    </div>
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
                "h-16 rounded-2xl bg-bg hover:bg-border/60 text-ink",
                "flex items-center justify-center transition-colors",
                "tap-target disabled:opacity-50",
              )}
            >
              <Delete className="size-6" />
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
              "h-16 rounded-2xl bg-bg hover:bg-border/60 text-ink",
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
