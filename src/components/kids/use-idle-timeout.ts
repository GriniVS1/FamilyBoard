"use client";

import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel"] as const;

/** Calls `onIdle` once after `ms` without a touch, key press or wheel event. */
export function useIdleTimeout(active: boolean, ms: number, onIdle: () => void): void {
  const onIdleRef = useRef(onIdle);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!active) return;

    let timer = window.setTimeout(() => onIdleRef.current(), ms);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => onIdleRef.current(), ms);
    };

    for (const name of ACTIVITY_EVENTS) document.addEventListener(name, reset, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const name of ACTIVITY_EVENTS) document.removeEventListener(name, reset);
    };
  }, [active, ms]);
}
