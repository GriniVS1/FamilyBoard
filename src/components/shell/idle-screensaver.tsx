"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

type IdleScreensaverProps = {
  minutes: number;
};

const ACTIVITY_EVENTS = ["pointerdown", "touchstart", "keydown"] as const;

export function IdleScreensaver({ minutes }: IdleScreensaverProps) {
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const arm = useCallback(
    (delay: number) => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        router.push("/screensaver");
      }, delay);
    },
    [router],
  );

  useEffect(() => {
    if (minutes === 0) return;
    if (pathname === "/screensaver" || pathname.startsWith("/setup")) return;

    const delay = minutes * 60 * 1000;

    function handleActivity() {
      arm(delay);
    }

    arm(delay);

    for (const ev of ACTIVITY_EVENTS) {
      document.addEventListener(ev, handleActivity, { passive: true });
    }

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      for (const ev of ACTIVITY_EVENTS) {
        document.removeEventListener(ev, handleActivity);
      }
    };
  }, [minutes, pathname, arm]);

  return null;
}
