"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { OnScreenKeyboard, keyBase } from "./onscreen-keyboard";

type WifiKeyboardProps = {
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
  onCancel: () => void;
  disabled?: boolean;
};

export function WifiKeyboard({ value, onChange, onEnter, onCancel, disabled = false }: WifiKeyboardProps) {
  const t = useTranslations("setup.network");
  const [showPassword, setShowPassword] = useState(false);

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

      <OnScreenKeyboard
        value={value}
        onChange={onChange}
        onEnter={onEnter}
        enterLabel={t("connect")}
        disabled={disabled}
        showAccents={false}
        trailingSlot={
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onPointerDown={(e) => e.preventDefault()}
            onClick={onCancel}
            disabled={disabled}
            className={cn(keyBase, "min-w-[52px] h-12 px-3 text-sm text-muted")}
          >
            <svg viewBox="0 0 16 16" className="size-4 fill-current" aria-hidden>
              <path d="M2 2 L14 14 M14 2 L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          </motion.button>
        }
      />
    </div>
  );
}
