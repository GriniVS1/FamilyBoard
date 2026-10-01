"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { toneOf } from "@/components/kids/tone";
import { cn } from "@/lib/utils";

type TodoCheckProps = {
  done: boolean;
  /** Assignee colour; to-dos without one use mint, the colour of the to-do area. */
  color?: string | null;
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

// Open = empty ring, done = filled disc with a tick: two different shapes, so
// state never depends on colour.
export function TodoCheck({ done, color, label, onClick, disabled }: TodoCheckProps) {
  const tone = toneOf(color ?? "mint");
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={done}
      className={cn(
        "tap-target inline-flex size-12 shrink-0 items-center justify-center rounded-full border-[3px]",
        "transition-colors duration-kid focus-ring-kid",
        done
          ? cn(tone.bg, tone.border, "text-on-accent")
          : "border-muted bg-surface text-transparent",
      )}
    >
      {done && <Check className="size-6 animate-check-pop" strokeWidth={3.5} />}
    </motion.button>
  );
}
