"use client";

import { motion } from "framer-motion";
import { LoaderCircle } from "lucide-react";

type SystemActionOverlayProps = {
  text: string;
};

// Stays mounted forever on purpose — the host is rebooting/shutting down, so
// there is no "done" state to transition to. For reboot the kiosk page itself
// reloads once the box comes back up and X11/Chromium relaunch; for shutdown
// the screen simply goes dark with the device powered off.
export function SystemActionOverlay({ text }: SystemActionOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      role="alert"
      aria-live="assertive"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-bg text-ink"
    >
      <LoaderCircle className="size-10 animate-spin text-muted" aria-hidden />
      <p className="font-display text-xl">{text}</p>
    </motion.div>
  );
}
