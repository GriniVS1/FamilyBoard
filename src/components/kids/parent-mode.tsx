"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Lock, Pencil } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogTitle } from "@/components/shared/dialog";
import { PinDots, PinKeypad } from "@/components/settings/pin-keypad";
import { cn } from "@/lib/utils";

/** Hard cap per unlock, and how long a wall can sit untouched before it re-locks. */
const SESSION_MS = 5 * 60_000;
const IDLE_MS = 120_000;
const PIN_LENGTH = 6;
const MAX_WRONG_TRIES = 2;

type ParentModeValue = {
  active: boolean;
  remainingMs: number;
  requestEnter: () => void;
  exit: () => void;
};

const INERT: ParentModeValue = {
  active: false,
  remainingMs: 0,
  requestEnter: () => undefined,
  exit: () => undefined,
};

const ParentModeContext = createContext<ParentModeValue>(INERT);

/** Outside a provider the mode is simply never active, so shared UI stays safe. */
export function useParentMode(): ParentModeValue {
  return useContext(ParentModeContext);
}

type SessionClock = { start: number; lastTouch: number; now: number };

export function ParentModeProvider({ children }: { children: ReactNode }) {
  const [clock, setClock] = useState<SessionClock | null>(null);
  const [pinOpen, setPinOpen] = useState(false);

  const active = clock !== null;

  useEffect(() => {
    if (!active) return;

    const touch = () =>
      setClock((c) => (c ? { ...c, lastTouch: Date.now(), now: Date.now() } : c));
    document.addEventListener("pointerdown", touch, { passive: true });
    document.addEventListener("keydown", touch);

    const id = window.setInterval(() => {
      setClock((c) => {
        if (!c) return c;
        const now = Date.now();
        if (now - c.start >= SESSION_MS || now - c.lastTouch >= IDLE_MS) return null;
        return { ...c, now };
      });
    }, 1000);

    return () => {
      document.removeEventListener("pointerdown", touch);
      document.removeEventListener("keydown", touch);
      window.clearInterval(id);
    };
  }, [active]);

  const requestEnter = useCallback(() => setPinOpen(true), []);
  const exit = useCallback(() => setClock(null), []);

  const value = useMemo<ParentModeValue>(() => {
    const remainingMs = clock
      ? Math.max(
          0,
          Math.min(clock.start + SESSION_MS - clock.now, clock.lastTouch + IDLE_MS - clock.now),
        )
      : 0;
    return { active, remainingMs, requestEnter, exit };
  }, [active, clock, requestEnter, exit]);

  return (
    <ParentModeContext.Provider value={value}>
      {children}
      <ParentPinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        onVerified={() => {
          const now = Date.now();
          setClock({ start: now, lastTouch: now, now });
          setPinOpen(false);
        }}
      />
    </ParentModeContext.Provider>
  );
}

type ParentPinDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
};

function ParentPinDialog({ open, onOpenChange, onVerified }: ParentPinDialogProps) {
  const t = useTranslations("parentMode");
  const reduced = useReducedMotion();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"wrong" | "tooMany" | "failed" | null>(null);
  const [shake, setShake] = useState(0);
  const wrongTries = useRef(0);

  useEffect(() => {
    if (!open) {
      setPin("");
      setError(null);
      setBusy(false);
      wrongTries.current = 0;
    }
  }, [open]);

  async function verify(candidate: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/pin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: candidate }),
      });
      if (res.status === 429) {
        setError("tooMany");
      } else if (!res.ok) {
        setError("failed");
      } else {
        const body = (await res.json()) as { ok?: boolean };
        if (body.ok) {
          onVerified();
          return;
        }
        setError("wrong");
      }
    } catch {
      setError("failed");
    }
    setShake((n) => n + 1);
    setPin("");
    setBusy(false);
    wrongTries.current += 1;
    // A child hammering the pad should land back on the child view, not on a lock screen.
    if (wrongTries.current >= MAX_WRONG_TRIES) window.setTimeout(() => onOpenChange(false), 700);
  }

  function press(digit: string) {
    if (busy || pin.length >= PIN_LENGTH) return;
    setError(null);
    const next = pin + digit;
    setPin(next);
    if (next.length === PIN_LENGTH) void verify(next);
  }

  function backspace() {
    if (busy) return;
    setError(null);
    setPin((p) => p.slice(0, -1));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="w-[min(380px,calc(100vw-2rem))]">
        <div className="flex flex-col items-center gap-5">
          <span
            aria-hidden
            className="inline-flex size-16 items-center justify-center rounded-full bg-warning-tint text-warning-ink"
          >
            <Lock className="size-8" strokeWidth={2.25} />
          </span>
          <div className="space-y-1 text-center">
            <DialogTitle className="kid-heading">{t("pinTitle")}</DialogTitle>
            <p className="text-sm text-muted">{t("pinHint")}</p>
          </div>
          <motion.div
            key={shake}
            animate={reduced || shake === 0 ? undefined : { x: [0, -8, 8, -6, 6, 0] }}
            transition={{ duration: 0.36 }}
          >
            <PinDots length={PIN_LENGTH} filled={pin.length} />
          </motion.div>
          <div className="w-full">
            <PinKeypad onPress={press} onBackspace={backspace} disabled={busy} />
          </div>
          <p
            role="alert"
            className={cn("min-h-5 text-center text-sm text-danger-ink", !error && "invisible")}
          >
            {error === "wrong" && t("wrongPin")}
            {error === "tooMany" && t("tooMany")}
            {error === "failed" && t("couldNotVerify")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The always-visible "Edit + lock" entry point; hidden while unlocked. */
export function ParentModeToggle({ className }: { className?: string }) {
  const t = useTranslations("parentMode");
  const { active, requestEnter } = useParentMode();
  if (active) return null;

  return (
    <button
      type="button"
      onClick={requestEnter}
      className={cn(
        "inline-flex h-12 items-center gap-2 rounded-full border-2 border-border bg-surface px-5",
        "kid-label text-ink shadow-pop focus-ring-kid",
        "transition-transform duration-100 ease-snappy active:translate-y-0.5 active:shadow-press",
        className,
      )}
    >
      <Lock className="size-5" strokeWidth={2.5} aria-hidden />
      <span>{t("edit")}</span>
    </button>
  );
}

function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function ParentModeBanner({ className }: { className?: string }) {
  const t = useTranslations("parentMode");
  const { active, remainingMs, exit } = useParentMode();
  if (!active) return null;

  return (
    <div
      role="region"
      aria-label={t("banner")}
      className={cn(
        "flex items-center gap-3 rounded-3xl border-2 border-warning bg-warning-tint px-4 py-2 text-warning-ink",
        className,
      )}
    >
      <Pencil className="size-6 shrink-0" strokeWidth={2.25} aria-hidden />
      <span className="kid-title">{t("banner")}</span>
      <span aria-hidden className="kid-label tabular ml-auto text-warning-ink/80">
        {t("remaining", { time: formatRemaining(remainingMs) })}
      </span>
      <button
        type="button"
        onClick={exit}
        className={cn(
          "inline-flex h-12 items-center rounded-full bg-surface px-5 kid-label text-ink shadow-pop",
          "focus-ring-kid transition-transform duration-100 ease-snappy active:translate-y-0.5 active:shadow-press",
        )}
      >
        {t("done")}
      </button>
    </div>
  );
}
