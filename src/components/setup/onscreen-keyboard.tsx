"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

export type Layer = "lower" | "upper" | "symbols" | "accents";

type CharKey = { kind: "char"; value: string };

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

const ACCENT_ROWS: string[][] = [
  ["à", "á", "â", "ä", "è", "é", "ê", "ë", "ì", "í"],
  ["î", "ï", "ò", "ó", "ô", "ö", "ù", "ú", "û", "ü"],
  ["ç", "ñ", "ß", "œ", "æ", "ø", "å"],
];

function buildRows(layer: Layer): CharKey[][] {
  const charRows =
    layer === "lower"
      ? LOWER_ROWS
      : layer === "upper"
        ? UPPER_ROWS
        : layer === "symbols"
          ? SYMBOL_ROWS
          : ACCENT_ROWS;
  return charRows.map((row) => row.map((c) => ({ kind: "char" as const, value: c })));
}

export const keyBase = cn(
  "rounded-2xl bg-bg text-ink font-sans text-base font-medium",
  "flex items-center justify-center transition-colors",
  "active:scale-[0.94] active:opacity-80",
  "disabled:opacity-40 tap-target",
  "border border-border/50 hover:bg-border/50",
);

type OnScreenKeyboardProps = {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  enterLabel?: string;
  disabled?: boolean;
  showAccents?: boolean;
  trailingSlot?: React.ReactNode;
  defaultLayer?: Layer;
};

function preventFocusSteal(e: React.PointerEvent) {
  e.preventDefault();
}

export function OnScreenKeyboard({
  value,
  onChange,
  onEnter,
  enterLabel,
  disabled = false,
  showAccents = true,
  trailingSlot,
  defaultLayer = "lower",
}: OnScreenKeyboardProps) {
  const [layer, setLayer] = useState<Layer>(defaultLayer);
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
  const isAccents = layer === "accents";
  const shiftDisabled = disabled || isSymbols || isAccents;

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="flex justify-center gap-1.5">
          {rowIdx === 2 && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onPointerDown={preventFocusSteal}
              onClick={handleShift}
              disabled={shiftDisabled}
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
              key={key.value}
              type="button"
              whileTap={{ scale: 0.92 }}
              onPointerDown={preventFocusSteal}
              onClick={() => handleChar(key.value)}
              disabled={disabled}
              className={cn(keyBase, "min-w-[52px] h-12 px-3 flex-1 max-w-[64px]")}
            >
              {key.value}
            </motion.button>
          ))}

          {rowIdx === 2 && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onPointerDown={preventFocusSteal}
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
          onPointerDown={preventFocusSteal}
          onClick={() => setLayer(isSymbols ? "lower" : "symbols")}
          disabled={disabled}
          className={cn(keyBase, "min-w-[64px] h-12 px-3 text-sm")}
        >
          {isSymbols ? "ABC" : "123"}
        </motion.button>

        {showAccents && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onPointerDown={preventFocusSteal}
            onClick={() => setLayer(isAccents ? "lower" : "accents")}
            disabled={disabled}
            className={cn(keyBase, "min-w-[52px] h-12 px-3 text-sm")}
          >
            {isAccents ? "ABC" : "áñü"}
          </motion.button>
        )}

        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onPointerDown={preventFocusSteal}
          onClick={handleSpace}
          disabled={disabled}
          className={cn(keyBase, "flex-1 h-12 px-3 text-sm text-muted")}
        >
          <span className="sr-only">Space</span>
        </motion.button>

        {onEnter && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onPointerDown={preventFocusSteal}
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
            {enterLabel}
          </motion.button>
        )}

        {trailingSlot}
      </div>
    </div>
  );
}
