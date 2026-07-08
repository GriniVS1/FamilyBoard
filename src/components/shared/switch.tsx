"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
};

// Larger tap-target than the visual pill (kiosk touch target minimum) —
// padding on the button expands the hit area without inflating the track.
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  ...props
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "tap-target inline-flex items-center justify-center rounded-full p-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
        "disabled:opacity-50 disabled:pointer-events-none",
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-7 w-12 items-center rounded-full transition-colors",
          checked ? "bg-ink" : "bg-border",
        )}
      >
        <motion.span
          animate={{ x: checked ? 26 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="absolute size-5 rounded-full bg-bg shadow-sm"
        />
      </span>
    </button>
  );
}
