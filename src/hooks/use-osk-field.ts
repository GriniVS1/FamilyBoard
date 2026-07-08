"use client";

import { useCallback, useState, type FocusEvent } from "react";

type OskFieldEvent = FocusEvent<HTMLInputElement | HTMLTextAreaElement>;

/**
 * Tracks which text field in a multi-field form currently owns the
 * on-screen keyboard panel. Third repeat of the setup/settings
 * onFocus/onBlur pattern (see caldav-connect-dialog.tsx) — extracted here
 * so kiosk dialogs don't hand-roll it again. Existing setup/settings
 * call sites keep their inline useState version untouched.
 */
export function useOskField<TField extends string>() {
  const [activeField, setActiveField] = useState<TField | null>(null);

  const bind = useCallback(
    (field: TField) => ({
      onFocus: (e: OskFieldEvent) => {
        setActiveField(field);
        const target = e.currentTarget;
        // Wait for the panel's spring-in to finish growing before scrolling,
        // otherwise the field ends up hidden behind the panel that's still animating.
        window.setTimeout(() => {
          target.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }, 260);
      },
      onBlur: () => {
        setActiveField((f) => (f === field ? null : f));
      },
    }),
    [],
  );

  return { activeField, bind, close: () => setActiveField(null) };
}
