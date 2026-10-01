"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type AvatarProgressRingProps = {
  diameter: number;
  stroke: number;
  /** 0–1 share of today's chores that are done. */
  fraction: number;
  arcClassName: string;
  trackClassName: string;
  className?: string;
};

/** Starts at 12 o'clock; the arc grows with a spring so a tick feels earned. */
export function AvatarProgressRing({
  diameter,
  stroke,
  fraction,
  arcClassName,
  trackClassName,
  className,
}: AvatarProgressRingProps) {
  const reduced = useReducedMotion();
  const radius = (diameter - stroke) / 2;
  const clamped = Math.max(0, Math.min(1, fraction));

  return (
    <svg
      viewBox={`0 0 ${diameter} ${diameter}`}
      width={diameter}
      height={diameter}
      className={cn("pointer-events-none absolute inset-0 -rotate-90", className)}
      aria-hidden
    >
      <circle
        cx={diameter / 2}
        cy={diameter / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        className={trackClassName}
      />
      <motion.circle
        cx={diameter / 2}
        cy={diameter / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        className={arcClassName}
        initial={false}
        animate={{ strokeDashoffset: 1 - clamped, opacity: clamped > 0 ? 1 : 0 }}
        transition={
          reduced ? { duration: 0 } : { type: "spring", stiffness: 220, damping: 30 }
        }
      />
    </svg>
  );
}
