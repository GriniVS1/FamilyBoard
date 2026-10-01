"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Sizes an element to the space left under it so a wall column can scroll
 * internally instead of growing the page. Measured rather than a calc() so it
 * keeps working when the shell's header or paddings change; it re-measures
 * after every render because banners above it come and go. `reserve` is room
 * kept free below it for good, so a toast never makes the columns jump.
 */
export function useViewportFill<T extends HTMLElement>(enabled: boolean, reserve: number = 0) {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [width, setWidth] = useState<number | null>(null);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const main = el.closest("main");
    const below = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
    const top = el.getBoundingClientRect().top + window.scrollY;
    setHeight(Math.max(360, Math.floor(window.innerHeight - top - below - reserve)));
    setWidth(el.clientWidth);
  }, [reserve]);

  useLayoutEffect(() => {
    if (enabled) measure();
    else setHeight(undefined);
  });

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [enabled, measure]);

  return { ref, width, style: height === undefined ? undefined : { height } };
}
