"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePictoDemo } from "./use-picto-demo";

type PictoDemoProps = {
  children: ReactNode;
  className?: string;
  /** Accessible name for the tap target (e.g. the task title). */
  label: string;
};

/** Tap-to-demo wrapper: a real button so it is reachable and announced. */
export function PictoDemo({ children, className, label }: PictoDemoProps) {
  const { play, demoProps } = usePictoDemo();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={play}
      className={cn("focus-ring-kid inline-flex items-center justify-center rounded-2xl", className)}
      {...demoProps}
    >
      {children}
    </button>
  );
}
