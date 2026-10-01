"use client";

import { RotateCw } from "lucide-react";
import { useEffect, useLayoutEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Picto, type PictoName } from "@/components/pictos";
import { cn } from "@/lib/utils";
import { UNDO_ARM_MS } from "@/lib/undo-guard";
import { UndoButton } from "./undo-button";

/** Height of the phone bar, and the tap-swallowing strip above it (see ToastShell). */
export const PHONE_TOAST_BAR_PX = 76;
export const PHONE_TOAST_BUFFER_PX = 16;

type ToastTone = "success" | "error";

const TONE: Record<ToastTone, string> = {
  success: "bg-success-tint border-success text-success-ink",
  error: "bg-danger-tint border-danger text-danger-ink",
};

type ToastShellProps = {
  tone: ToastTone;
  children: ReactNode;
  /**
   * CSS selector of the area to centre on from `md` up (the wall's main column,
   * not the whole screen, so the side rail does not skew it).
   */
  centerOn?: string;
  className?: string;
};

/**
 * The toast's frame. Wall: a card at the bottom centre of the main area.
 * Phone: an opaque full-width bar that sits on top of the bottom nav like part
 * of it, with a strip above it that swallows taps, so a finger aimed at a card
 * near the bar can never land on the ↶.
 */
export function ToastShell({ tone, children, centerOn, className }: ToastShellProps) {
  const [centerX, setCenterX] = useState<number | null>(null);
  const [navOffset, setNavOffset] = useState(96);

  useLayoutEffect(() => {
    if (centerOn) {
      const area = document.querySelector(centerOn);
      if (area) {
        const rect = area.getBoundingClientRect();
        setCenterX(rect.left + rect.width / 2);
      }
    }
    const measure = () => {
      const nav = document.querySelector("nav.fixed.bottom-0");
      if (nav) setNavOffset(Math.round(window.innerHeight - nav.getBoundingClientRect().top));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [centerOn]);

  const vars = {
    "--toast-bottom": `${navOffset}px`,
    ...(centerX === null ? {} : { "--toast-left": `${centerX}px` }),
  } as CSSProperties;

  return (
    <div
      data-toast=""
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      style={vars}
      className={cn(
        "fixed inset-x-0 bottom-[var(--toast-bottom)] z-50 animate-toast-in",
        "border-t-2 px-3 py-2 shadow-lift",
        "md:inset-x-auto md:bottom-3 md:mx-0 md:w-[448px] md:rounded-3xl md:border-2",
        centerX !== null && "md:left-[var(--toast-left)] md:-ml-[224px]",
        TONE[tone],
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 md:hidden"
        style={{ top: -PHONE_TOAST_BUFFER_PX, height: PHONE_TOAST_BUFFER_PX }}
      />
      <div className="flex min-h-14 items-center gap-3">{children}</div>
    </div>
  );
}

export type KidToastAction =
  | { kind: "undo"; onClick: () => void; color?: string | null; label?: string }
  | { kind: "retry"; onClick: () => void };

type KidToastProps = {
  tone: ToastTone;
  picto: PictoName;
  /** Optional short line for adults; the picto + action must carry the meaning. */
  children?: ReactNode;
  /** Extra visual (e.g. "+2 ⭐" chip or an avatar) shown next to the picto. */
  aside?: ReactNode;
  action?: KidToastAction;
  /** Auto-dismiss after this long; omit to keep until acted on (errors). */
  durationMs?: number;
  centerOn?: string;
  onDismiss: () => void;
};

/** One message with one action; the caller owns the slot. */
export function KidToast({
  tone,
  picto,
  children,
  aside,
  action,
  durationMs,
  centerOn,
  onDismiss,
}: KidToastProps) {
  const t = useTranslations("kids");

  useEffect(() => {
    if (!durationMs) return;
    const id = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(id);
  }, [durationMs, onDismiss]);

  return (
    <ToastShell tone={tone} centerOn={centerOn}>
      {action?.kind === "undo" ? (
        <UndoButton
          onClick={() => {
            action.onClick();
            onDismiss();
          }}
          color={action.color}
          label={action.label}
          countdownMs={durationMs}
          appearAfterMs={UNDO_ARM_MS}
        />
      ) : action?.kind === "retry" ? (
        <button
          type="button"
          onClick={() => {
            action.onClick();
            onDismiss();
          }}
          aria-label={t("retry")}
          className={cn(
            "inline-flex size-14 shrink-0 items-center justify-center rounded-full",
            "bg-surface text-ink shadow-pop focus-ring-kid",
            "transition-transform duration-100 ease-snappy active:translate-y-0.5 active:shadow-press",
          )}
        >
          <RotateCw className="size-7" strokeWidth={2.5} />
        </button>
      ) : null}
      <Picto name={picto} size={48} />
      {aside}
      <div className="kid-body min-w-0 flex-1">{children}</div>
      {!action && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("dismiss")}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full text-current focus-ring-kid"
        >
          <span aria-hidden className="text-2xl leading-none">×</span>
        </button>
      )}
    </ToastShell>
  );
}
