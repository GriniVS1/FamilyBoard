"use client";

import { motion } from "framer-motion";
import { cn, isMemberColor, type MemberColor } from "@/lib/utils";
import { TINT_BAR } from "./types";

type WeeklyProgressBarProps = {
  earned: number;
  target: number;
  color: string;
  className?: string;
};

export function WeeklyProgressBar({
  earned,
  target,
  color,
  className,
}: WeeklyProgressBarProps) {
  const safeColor: MemberColor = isMemberColor(color) ? color : "sand";
  const ratio = target > 0 ? Math.min(1, earned / target) : 0;

  return (
    <div
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-bg",
        className,
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuenow={Math.min(earned, target)}
    >
      <motion.div
        className={cn("h-full rounded-full", TINT_BAR[safeColor])}
        initial={false}
        animate={{ width: `${ratio * 100}%` }}
        transition={{ type: "spring", stiffness: 220, damping: 30 }}
      />
    </div>
  );
}
