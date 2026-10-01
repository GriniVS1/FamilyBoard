"use client";

import { useRef } from "react";

/**
 * Radix returns focus to the dialog's trigger, and our dialogs open from plain
 * buttons, so focus would drop to the page. This puts it back on whatever had
 * it when the dialog opened (if that is still on screen).
 */
export function useRestoreFocus() {
  const opener = useRef<HTMLElement | null>(null);

  return {
    onOpenAutoFocus: () => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    },
    onCloseAutoFocus: (event: Event) => {
      const target = opener.current;
      if (!target?.isConnected) return;
      event.preventDefault();
      target.focus();
    },
  };
}
