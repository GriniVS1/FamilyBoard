"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Delete, Lock } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";
import { postJson } from "@/components/setup/types";

const PIN_LENGTH = 6;

type PinGateProps = {
  onUnlock: () => void;
  onUnlockWithPin?: (pin: string) => void;
  title?: string;
  description?: string;
};

export function PinGate({
  onUnlock,
  onUnlockWithPin,
  title,
  description,
}: PinGateProps) {
  const t = useTranslations("settings");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headingText = title ?? t("enterPin");
  const descriptionText = description ?? t("pinProtected");

  function press(value: string) {
    if (submitting) return;
    setError(null);
    setPin((prev) => {
      if (prev.length >= PIN_LENGTH) return prev;
      const next = prev + value;
      if (next.length === PIN_LENGTH) {
        verify(next);
      }
      return next;
    });
  }

  function backspace() {
    if (submitting) return;
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  }

  async function verify(candidate: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await postJson<{ ok: boolean }>(
        "/api/settings/pin/verify",
        { pin: candidate },
      );
      if (res.ok) {
        onUnlockWithPin?.(candidate);
        onUnlock();
      } else {
        setError(t("wrongPin"));
        setPin("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("couldNotVerify"));
      setPin("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <GlassCard className="mx-auto flex w-full max-w-md flex-col items-center gap-6 p-8">
      <span
        aria-hidden
        className="inline-flex size-14 items-center justify-center rounded-full bg-accent-sun/30 text-ink"
      >
        <Lock className="size-6" />
      </span>

      <div className="space-y-1 text-center">
        <h3 className="font-display text-xl tracking-tight text-ink">{headingText}</h3>
        <p className="text-sm text-muted">{descriptionText}</p>
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
    </GlassCard>
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
    <div className="grid w-full grid-cols-3 gap-3">
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

type GateOverlayProps = {
  children: React.ReactNode;
  locked: boolean;
};

export function GateOverlay({ children, locked }: GateOverlayProps) {
  return (
    <div className="relative">
      <div
        className={cn(
          "transition-opacity",
          locked && "pointer-events-none select-none opacity-50",
        )}
        aria-disabled={locked}
      >
        {children}
      </div>
    </div>
  );
}

export { Button };
