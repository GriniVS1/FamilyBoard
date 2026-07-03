"use client";

import { AnimatePresence, motion } from "framer-motion";
import { OnScreenKeyboard, type Layer } from "./onscreen-keyboard";

type InlineKeyboardPanelProps = {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  defaultLayer?: Layer;
  showAccents?: boolean;
};

export function InlineKeyboardPanel({
  open,
  value,
  onChange,
  defaultLayer,
  showAccents,
}: InlineKeyboardPanelProps) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="overflow-hidden"
        >
          <div className="rounded-3xl bg-surface border border-border shadow-soft p-4 mt-3">
            <OnScreenKeyboard
              value={value}
              onChange={onChange}
              defaultLayer={defaultLayer}
              showAccents={showAccents}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
