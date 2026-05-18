"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, Smartphone, Wifi, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";
import { WifiKeyboard } from "./wifi-keyboard";
import { WifiNetworkList, type WifiNetwork } from "./wifi-network-list";
import { WifiHotspotQr } from "./wifi-hotspot-qr";

type Mode = "list" | "keyboard" | "hotspot" | "connecting";

type HotspotInfo = {
  ssid: string;
  psk: string;
  ipAddress: string;
};

type StepNetworkProps = {
  onComplete: () => void;
  onSkip: () => void;
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      if (data?.error?.message) message = data.error.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export function StepNetwork({ onComplete, onSkip }: StepNetworkProps) {
  const t = useTranslations("setup.network");
  const [mode, setMode] = useState<Mode>("list");
  const [isConnecting, setIsConnecting] = useState(false);
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [loadingNetworks, setLoadingNetworks] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<WifiNetwork | null>(null);
  const [password, setPassword] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectingSsid, setConnectingSsid] = useState<string | null>(null);
  const [hotspot, setHotspot] = useState<HotspotInfo | null>(null);
  const [hotspotStarting, setHotspotStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scan = useCallback(async () => {
    setLoadingNetworks(true);
    try {
      const data = await fetchJson<{ networks: WifiNetwork[] }>("/api/network/wifi-scan");
      setNetworks(data.networks);
    } catch {
      setNetworks([]);
    } finally {
      setLoadingNetworks(false);
    }
  }, []);

  useEffect(() => {
    void scan();
  }, [scan]);

  function stopPoll() {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  useEffect(() => {
    return () => stopPoll();
  }, []);

  function startHotspotPoll() {
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const status = await fetchJson<{
          connected: boolean;
          hotspotActive: boolean;
          ssid?: string;
          ipAddress?: string;
          online?: boolean;
        }>("/api/network/status");
        if (status.connected && !status.hotspotActive) {
          stopPoll();
          await stopHotspot();
          onComplete();
        }
      } catch {
        // keep polling
      }
    }, 2000);
  }

  async function stopHotspot() {
    try {
      await postJson("/api/network/hotspot-stop");
    } catch {
      // best-effort
    }
    setHotspot(null);
  }

  function selectNetwork(network: WifiNetwork) {
    setSelectedNetwork(network);
    setPassword("");
    setConnectError(null);
    if (!network.secured) {
      void connectDirect(network.ssid, undefined);
    } else {
      setMode("keyboard");
    }
  }

  async function connectDirect(ssid: string, psk: string | undefined) {
    setConnectingSsid(ssid);
    setIsConnecting(true);
    setMode("connecting");
    setConnectError(null);
    try {
      await postJson("/api/network/wifi-connect", { ssid, psk });
      onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("connectFailed");
      setConnectError(msg);
      setMode("keyboard");
      setConnectingSsid(null);
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleConnect() {
    if (!selectedNetwork) return;
    await connectDirect(selectedNetwork.ssid, password || undefined);
  }

  async function handleStartHotspot() {
    setHotspotStarting(true);
    try {
      const info = await postJson<HotspotInfo>("/api/network/hotspot-start");
      setHotspot(info);
      setMode("hotspot");
      startHotspotPoll();
    } catch {
      // stay on list; surface no error (user can retry)
    } finally {
      setHotspotStarting(false);
    }
  }

  async function handleBackFromHotspot() {
    stopPoll();
    await stopHotspot();
    setMode("list");
  }

  const connectingLabel = connectingSsid
    ? t("connecting", { ssid: connectingSsid })
    : t("connecting", { ssid: "…" });

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-accent-sky/30">
            <Wifi className="size-5 text-ink" />
          </span>
          <p className="text-muted text-sm font-medium tracking-wide uppercase">
            {t("title")}
          </p>
        </div>
        <h2 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05]">
          {t("title")}
        </h2>
        <p className="text-muted text-lg">{t("subtitle")}</p>
      </div>

      <AnimatePresence mode="wait">
        {mode === "connecting" && (
          <motion.div
            key="connecting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 py-16"
          >
            <Loader2 className="size-10 text-muted animate-spin" />
            <p className="text-muted text-lg">{connectingLabel}</p>
          </motion.div>
        )}

        {mode === "hotspot" && hotspot && (
          <motion.div key="hotspot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <WifiHotspotQr
              hotspot={hotspot}
              polling={pollRef.current !== null}
              onBack={() => void handleBackFromHotspot()}
            />
          </motion.div>
        )}

        {(mode === "list" || mode === "keyboard") && (
          <motion.div
            key="list-keyboard"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-4"
          >
            <GlassCard className="p-4 overflow-hidden">
              <div className="max-h-[280px] overflow-y-auto">
                <WifiNetworkList
                  networks={networks}
                  loading={loadingNetworks}
                  selectedSsid={selectedNetwork?.ssid ?? null}
                  onSelect={selectNetwork}
                />
              </div>

              <AnimatePresence>
                {mode === "keyboard" && selectedNetwork && (
                  <motion.div
                    key="keyboard"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 border-t border-border mt-3">
                      <p className="text-sm font-medium text-ink mb-3">
                        {t("passwordFor", { ssid: selectedNetwork.ssid })}
                      </p>

                      <AnimatePresence>
                        {connectError && (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            role="alert"
                            className="mb-3 text-sm text-accent-rose"
                          >
                            {connectError}
                          </motion.p>
                        )}
                      </AnimatePresence>

                      <WifiKeyboard
                        value={password}
                        onChange={setPassword}
                        onEnter={() => void handleConnect()}
                        onCancel={() => {
                          setMode("list");
                          setSelectedNetwork(null);
                          setPassword("");
                          setConnectError(null);
                        }}
                        disabled={isConnecting}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void scan()}
                disabled={loadingNetworks}
              >
                <RefreshCw className={`size-4 ${loadingNetworks ? "animate-spin" : ""}`} />
                {t("rescan")}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => void handleStartHotspot()}
                disabled={hotspotStarting}
              >
                {hotspotStarting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Smartphone className="size-4" />
                )}
                {t("usePhone")}
              </Button>

              <div className="flex-1" />

              <Button type="button" variant="ghost" onClick={onSkip} className="text-muted">
                {t("skipForNow")}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
