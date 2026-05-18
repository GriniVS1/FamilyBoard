"use client";

import { useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { motion } from "framer-motion";
import { Loader2, Smartphone, Wifi, Monitor } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";

type HotspotInfo = {
  ssid: string;
  psk: string;
  ipAddress: string;
};

type WifiHotspotQrProps = {
  hotspot: HotspotInfo;
  polling: boolean;
  onBack: () => void;
};

export function WifiHotspotQr({ hotspot, polling, onBack }: WifiHotspotQrProps) {
  const t = useTranslations("setup.network");

  const wifiQrValue = `WIFI:T:WPA;S:${hotspot.ssid};P:${hotspot.psk};;`;
  const urlQrValue = `http://${hotspot.ipAddress}:3000/setup/network/phone`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <GlassCard className="p-5 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-accent-peach/30 text-xs font-bold">1</span>
            <Wifi className="size-4 text-muted" />
            <span>{t("phoneStep1")}</span>
          </div>
          <div className="rounded-2xl bg-surface p-3 border border-border">
            <QRCodeSVG
              value={wifiQrValue}
              size={180}
              bgColor="transparent"
              fgColor="currentColor"
              className="text-ink"
              level="M"
            />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-ink">{hotspot.ssid}</p>
            <p className="text-xs text-muted font-mono mt-0.5">{hotspot.psk}</p>
          </div>
        </GlassCard>

        <GlassCard className="p-5 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-accent-mint/30 text-xs font-bold">2</span>
            <Smartphone className="size-4 text-muted" />
            <span>{t("phoneStep2")}</span>
          </div>
          <div className="rounded-2xl bg-surface p-3 border border-border">
            <QRCodeSVG
              value={urlQrValue}
              size={180}
              bgColor="transparent"
              fgColor="currentColor"
              className="text-ink"
              level="M"
            />
          </div>
          <p className="text-xs text-muted font-mono text-center break-all">{urlQrValue}</p>
        </GlassCard>
      </div>

      <GlassCard className="p-4 flex items-center gap-3">
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-accent-sun/30 text-xs font-bold shrink-0">3</span>
        <Monitor className="size-4 text-muted shrink-0" />
        <p className="flex-1 text-sm text-ink">{t("phoneStep3")}</p>
        {polling && (
          <Loader2 className="size-4 text-muted animate-spin shrink-0" />
        )}
      </GlassCard>

      <div className="flex justify-start">
        <Button type="button" variant="ghost" onClick={onBack}>
          {t("backToKeyboard")}
        </Button>
      </div>
    </motion.div>
  );
}
