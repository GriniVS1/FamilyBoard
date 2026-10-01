"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Picto } from "@/components/pictos";
import { isUndoArmed } from "@/lib/undo-guard";
import { cn } from "@/lib/utils";
import { toneOf } from "./tone";

type UndoButtonProps = {
  onClick: () => void;
  /** Member colour of the countdown ring. */
  color?: string | null;
  /** When set, a ring runs down over this time so the remaining window is visible without text. */
  countdownMs?: number;
  size?: number;
  /**
   * Fade in only after this long, so the button is never visible but dead:
   * it appears exactly when it starts to work.
   */
  appearAfterMs?: number;
  label?: string;
  disabled?: boolean;
  className?: string;
};

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function UndoButton({
  onClick,
  color,
  countdownMs,
  size = 56,
  appearAfterMs,
  label,
  disabled,
  className,
}: UndoButtonProps) {
  const t = useTranslations("kids");
  const reduced = useReducedMotion();
  const tone = toneOf(color);
  const shownAt = useRef<number | null>(null);
  shownAt.current ??= Date.now();
  const [visible, setVisible] = useState(!appearAfterMs);

  useEffect(() => {
    if (!appearAfterMs) return;
    const timer = window.setTimeout(() => setVisible(true), appearAfterMs);
    return () => window.clearTimeout(timer);
  }, [appearAfterMs]);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!isUndoArmed(shownAt.current ?? 0, Date.now())) return;
        onClick();
      }}
      disabled={disabled}
      aria-label={label ?? t("undo")}
      aria-hidden={visible ? undefined : true}
      tabIndex={visible ? undefined : -1}
      style={{ width: size, height: size }}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full",
        "border-2 border-muted/60 bg-surface text-ink shadow-pop",
        "transition-[opacity,transform] duration-200 ease-snappy active:translate-y-0.5 active:shadow-press",
        "disabled:opacity-50 focus-ring-kid",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
        className,
      )}
    >
      <Picto name="undo" size={Math.round(size * 0.58)} />
      {countdownMs ? (
        <svg
          viewBox="0 0 100 100"
          className="pointer-events-none absolute -inset-1 -rotate-90"
          style={{ width: size + 8, height: size + 8 }}
          aria-hidden
        >
          <motion.circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            className={tone.stroke}
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: 0 }}
            animate={{ strokeDashoffset: reduced ? 0 : CIRCUMFERENCE }}
            transition={{ duration: reduced ? 0 : countdownMs / 1000, ease: "linear" }}
          />
        </svg>
      ) : null}
    </button>
  );
}
