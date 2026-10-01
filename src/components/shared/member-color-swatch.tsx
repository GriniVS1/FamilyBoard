"use client";

import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("common");
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      aria-label={ariaLabel ?? t("selectColor", { color: t(`colors.${color}`) })}
      aria-pressed={selected}
      className={cn(
        "relative size-12 rounded-full tap-target flex items-center justify-center",
        "ring-offset-2 ring-offset-bg transition-shadow focus-ring-kid",
        COLOR_BG[color],
        selected ? "ring-2 ring-ink shadow-lift" : "ring-1 ring-border",
      )}
    >
      {selected && (
        <Check className="size-6 text-on-accent" strokeWidth={3.5} />
      )}
    </motion.button>
  );
}
