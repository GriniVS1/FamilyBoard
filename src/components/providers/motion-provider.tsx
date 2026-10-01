"use client";

import { MotionConfig } from "framer-motion";

// "user" makes every framer-motion transform/layout animation honour the OS
// prefers-reduced-motion setting; opacity/colour changes still play.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
