"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Delete, Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type Layer = "lower" | "upper" | "symbols";

type KeyDef =
  | { kind: "char"; value: string }
  | { kind: "special"; action: "shift" | "symbols" | "lower" | "backspace" | "space" | "enter" | "cancel" };

const LOWER_ROWS: string[][] = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const UPPER_ROWS: string[][] = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
];

const SYMBOL_ROWS: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["-", "/", ":", ";", "(", ")", "$", "&", "@", "\""],
  [".", ",", "?", "!", "'", "_", "#", "%"],
];

function buildRows(layer: Layer): KeyDef[][] {
  const charRows = layer === "lower" ? LOWER_ROWS : layer === "upper" ? UPPER_ROWS : SYMBOL_ROWS;
  return charRows.map((row) => row.map((c) => ({ kind: "char" as const, value: c })));
}

type WifiKeyboardProps = {
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
  onCancel: () => void;
  disabled?: boolean;
};

export function WifiKeyboard({ value, onChange, onEnter, onCancel, disabled = false }: WifiKeyboardProps) {
  const t = useTranslations("setup.network");
  const [layer, setLayer] = useState<Layer>("lower");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLocked, setCapsLocked] = useState(false);

  function handleChar(char: string) {
    if (disabled) return;
    onChange(value + char);
    if (layer === "upper" && !capsLocked) {
      setLayer("lower");
    }
  }

  function handleShift() {
    if (layer === "lower") {
      setLayer("upper");
      setCapsLocked(false);
    } else if (layer === "upper") {
      if (capsLocked) {
        setLayer("lower");
        setCapsLocked(false);
      } else {
        setCapsLocked(true);
      }
    }
  }

  function handleBackspace() {
    if (disabled) return;
    onChange(value.slice(0, -1));
  }

  function handleSpace() {
    if (disabled) return;
    onChange(value + " ");
  }

  const rows = buildRows(layer);
  const isUpper = layer === "upper";
  const isSymbols = layer === "symbols";

  const keyBase = cn(
    "rounded-2xl bg-bg text-ink font-sans text-base font-medium",
    "flex items-center justify-center transition-colors",
    "active:scale-[0.94] active:opacity-80",
    "disabled:opacity-40 tap-target",
    "border border-border/50 hover:bg-border/50",
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type={showPassword ? "text" : "password"}
            value={value}
            readOnly
            aria-label={t("passwordPlaceholder")}
            placeholder={t("passwordPlaceholder")}
            className={cn(
              "w-full h-14 rounded-2xl border border-border bg-bg px-4 pr-14",
              "text-ink text-lg tracking-wider font-mono",
              "focus:outline-none",
            )}
          />
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={t("showPassword")}
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2",
              "size-9 rounded-full flex items-center justify-center",
              "text-muted hover:text-ink hover:bg-border/50 transition-colors",
            )}
          >
            {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </motion.button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className="flex justify-center gap-1.5">
            {rowIdx === 2 && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={handleShift}
                disabled={disabled || isSymbols}
                aria-label="Shift"
                className={cn(
                  keyBase,
                  "px-3 min-w-[52px]",
                  isUpper && "bg-ink/15 border-ink/30",
                  capsLocked && "bg-accent-sky/30 border-accent-sky/40",
                )}
              >
                <svg viewBox="0 0 16 16" className="size-4 fill-current" aria-hidden>
                  <path d="M8 1 L15 9 H10 V15 H6 V9 H1 Z" />
                </svg>
              </motion.button>
            )}

            {row.map((key) => (
              <motion.button
                key={key.kind === "char" ? key.value : key.action}
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => key.kind === "char" && handleChar(key.value)}
                disabled={disabled}
                className={cn(keyBase, "min-w-[52px] h-12 px-3 flex-1 max-w-[64px]")}
              >
                {key.kind === "char" ? key.value : null}
              </motion.button>
            ))}

            {rowIdx === 2 && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={handleBackspace}
                disabled={disabled}
                aria-label="Backspace"
                className={cn(keyBase, "px-3 min-w-[52px]")}
              >
                <Delete className="size-4" />
              </motion.button>
            )}
          </div>
        ))}

        <div className="flex justify-center gap-1.5">
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => setLayer(isSymbols ? "lower" : "symbols")}
            disabled={disabled}
            className={cn(keyBase, "min-w-[64px] h-12 px-3 text-sm")}
          >
            {isSymbols ? "ABC" : "123"}
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={handleSpace}
            disabled={disabled}
            className={cn(keyBase, "flex-1 h-12 px-3 text-sm text-muted")}
          >
            <span className="sr-only">Space</span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={onEnter}
            disabled={disabled || value.length === 0}
            className={cn(
              "rounded-2xl bg-ink text-bg font-medium text-sm",
              "flex items-center justify-center transition-colors",
              "active:scale-[0.94] tap-target",
              "min-w-[64px] h-12 px-3",
              "disabled:opacity-40",
            )}
          >
            {t("connect")}
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={onCancel}
            disabled={disabled}
            className={cn(keyBase, "min-w-[52px] h-12 px-3 text-sm text-muted")}
          >
            <svg viewBox="0 0 16 16" className="size-4 fill-current" aria-hidden>
              <path d="M2 2 L14 14 M14 2 L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
