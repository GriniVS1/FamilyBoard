"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Height that lets an element end exactly where the page's bottom padding
 * begins, so the calendar grid scrolls inside its own box and the controls
 * above it never leave the screen.
 */
export function useFillHeight<T extends HTMLElement>(minPx: number) {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const main = el.closest("main");
    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const bottomPad = main ? parseFloat(getComputedStyle(main).paddingBottom) : 0;
      setHeight(Math.max(minPx, Math.floor(window.innerHeight - top - bottomPad)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [minPx]);

  return [ref, height] as const;
}
