"use client";

import { motion } from "framer-motion";
import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

type PinDotsProps = {
  length: number;
  filled: number;
};

export function PinDots({ length, filled }: PinDotsProps) {
  return (
    <div className="flex justify-center gap-3">
      {Array.from({ length }).map((_, idx) => {
        const isFilled = idx < filled;
        return (
          <motion.div
            key={idx}
            animate={{ scale: isFilled ? 1 : 0.85 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className={cn(
              "size-4 rounded-full transition-colors",
              isFilled ? "bg-ink" : "bg-border",
            )}
          />
        );
      })}
    </div>
  );
}

type PinKeypadProps = {
  onPress: (value: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
};

const KEYS: (string | "backspace" | null)[] = [
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

// Kiosk has no system on-screen keyboard, so PIN entry is always this
// dedicated numeric pad — never a plain text input. Shared by every dialog
// that asks for the admin PIN alone (no secondary text confirmation).
export function PinKeypad({ onPress, onBackspace, disabled }: PinKeypadProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {KEYS.map((key, idx) => {
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
