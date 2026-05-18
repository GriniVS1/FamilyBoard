"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, Lock, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type WifiNetwork = {
  ssid: string;
  signal: number;
  secured: boolean;
};

type WifiNetworkListProps = {
  networks: WifiNetwork[];
  loading: boolean;
  selectedSsid: string | null;
  onSelect: (network: WifiNetwork) => void;
};

function SignalBars({ signal }: { signal: number }) {
  const bars = 4;
  const filled = Math.round((signal / 100) * bars);
  return (
    <div className="flex items-end gap-0.5" aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "w-1.5 rounded-sm transition-colors",
            i < filled ? "bg-ink" : "bg-border",
          )}
          style={{ height: `${(i + 1) * 4 + 4}px` }}
        />
      ))}
    </div>
  );
}

export function WifiNetworkList({
  networks,
  loading,
  selectedSsid,
  onSelect,
}: WifiNetworkListProps) {
  const t = useTranslations("setup.network");

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-muted">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">{t("scanning")}</span>
      </div>
    );
  }

  if (networks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <WifiOff className="size-8 text-muted" />
        <p className="text-sm text-muted">{t("empty")}</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1" role="listbox" aria-label={t("title")}>
      <AnimatePresence initial={false}>
        {networks.map((net) => {
          const isSelected = net.ssid === selectedSsid;
          return (
            <motion.li
              key={net.ssid}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelect(net)}
                role="option"
                aria-selected={isSelected}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-colors tap-target",
                  "border text-left",
                  isSelected
                    ? "border-accent-sky/60 bg-accent-sky/15"
                    : "border-border hover:bg-bg",
                )}
              >
                <Wifi
                  className={cn(
                    "size-5 shrink-0",
                    isSelected ? "text-accent-sky" : "text-muted",
                  )}
                />
                <span className="flex-1 min-w-0 font-medium text-ink truncate">
                  {net.ssid}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <SignalBars signal={net.signal} />
                  {net.secured && (
                    <Lock className="size-3.5 text-muted" />
                  )}
                </div>
              </motion.button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
