"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Longest motif animation (pour) plus a little slack. */
const DEMO_MS = 1400;

/**
 * Spread `demoProps` on any ancestor of a <Picto> and call `play()` on tap.
 * Re-tapping restarts the animation instead of being ignored.
 */
export function usePictoDemo() {
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);
  const frame = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    timer.current = null;
    frame.current = null;
  }, []);

  const play = useCallback(() => {
    clear();
    setPlaying(false);
    frame.current = window.requestAnimationFrame(() => {
      setPlaying(true);
      timer.current = window.setTimeout(() => setPlaying(false), DEMO_MS);
    });
  }, [clear]);

  useEffect(() => clear, [clear]);

  return {
    play,
    playing,
    demoProps: { "data-picto-demo": playing ? "true" : "false" } as const,
  };
}
