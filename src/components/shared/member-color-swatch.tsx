"use client";

import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { MemberColor } from "@/lib/utils";

const COLOR_BG: Record<MemberColor, string> = {
  peach: "bg-accent-peach",
  mint: "bg-accent-mint",
  sun: "bg-accent-sun",
  sky: "bg-accent-sky",
  lilac: "bg-accent-lilac",
  rose: "bg-accent-rose",
  teal: "bg-accent-teal",
  sand: "bg-accent-sand",
};

export function memberColorClass(color: MemberColor): string {
  return COLOR_BG[color];
}

type MemberColorSwatchProps = {
  color: MemberColor;
  selected?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
};

export function MemberColorSwatch({
  color,
  selected = false,
  onClick,
  ariaLabel,
}: MemberColorSwatchProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      aria-label={ariaLabel ?? `Select color ${color}`}
      aria-pressed={selected}
      className={cn(
        "relative size-12 rounded-full tap-target flex items-center justify-center",
        "ring-offset-2 ring-offset-bg transition-shadow",
        COLOR_BG[color],
        selected ? "ring-2 ring-ink shadow-lift" : "ring-1 ring-border",
      )}
    >
      {selected && (
        <Check className="size-5 text-ink drop-shadow-sm" strokeWidth={3} />
      )}
    </motion.button>
  );
}
