"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { LAYOUT_QUIET_MS, shouldHoldLayout } from "@/lib/tap-guards";

type Shown<T> = { value: T; signature: string };

type HeldOptions = {
  /** Timestamp (ms) of the last touch anywhere in the column. */
  touchedAt: MutableRefObject<number>;
  /** A ↶ window of this column is still open. */
  windowOpen: boolean;
};

/**
 * Keeps showing the previous `value` while the layout-relevant `signature`
 * changes under a child who is still tapping (recent touch or open ↶ window).
 * It lets go once the column has been left alone for LAYOUT_QUIET_MS and the
 * window is closed; any touch restarts that wait. Without interaction, changes
 * apply at once.
 */
export function useHeldLayout<T>(live: T, signature: string, options: HeldOptions) {
  const { touchedAt, windowOpen } = options;
  const [shown, setShown] = useState<Shown<T>>({ value: live, signature });
  const [held, setHeld] = useState(false);

  const latest = useRef<Shown<T>>({ value: live, signature });
  const windowRef = useRef(windowOpen);

  useEffect(() => {
    latest.current = { value: live, signature };
    windowRef.current = windowOpen;
  });

  if (!held && shown.signature !== signature) {
    if (shouldHoldLayout({ now: Date.now(), lastTouchAt: touchedAt.current, windowOpen })) {
      setHeld(true);
    } else {
      setShown({ value: live, signature });
    }
  }

  useEffect(() => {
    if (!held) return;
    const timer = window.setInterval(() => {
      const stillHeld = shouldHoldLayout({
        now: Date.now(),
        lastTouchAt: touchedAt.current,
        windowOpen: windowRef.current,
        quietMs: LAYOUT_QUIET_MS,
      });
      if (!stillHeld) {
        setHeld(false);
        setShown(latest.current);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [held, touchedAt]);

  return { value: shown.value, signature: shown.signature, held };
}
