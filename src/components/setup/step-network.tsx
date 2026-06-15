"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, Smartphone, Wifi, Loader2, Globe, Search } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";
import { WifiKeyboard } from "./wifi-keyboard";
import { WifiNetworkList, type WifiNetwork } from "./wifi-network-list";
import { WifiHotspotQr } from "./wifi-hotspot-qr";

type Mode = "country" | "list" | "keyboard" | "hotspot" | "connecting";

type HotspotInfo = {
  ssid: string;
  psk: string;
  ipAddress: string;
};

type CountryApiResponse = {
  country: string | null;
  supported: string[];
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
      // ignore parse failure
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

function useCountryNames(codes: string[], locale: string): Map<string, string> {
  return useMemo(() => {
    const map = new Map<string, string>();
    let displayNames: Intl.DisplayNames;
    try {
      displayNames = new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    }
    for (const code of codes) {
      const name = displayNames.of(code);
      map.set(code, name ?? code);
    }
    return map;
  }, [codes, locale]);
}

export function StepNetwork({ onComplete, onSkip }: StepNetworkProps) {
  const t = useTranslations("setup.network");
  const locale = useLocale();

  const [mode, setMode] = useState<Mode>("list");
  const [countryInitialized, setCountryInitialized] = useState(false);
  const [supportedCountries, setSupportedCountries] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [countrySearch, setCountrySearch] = useState("");
  const [countryPosting, setCountryPosting] = useState(false);
  const [countryError, setCountryError] = useState<string | null>(null);

  const [isConnecting, setIsConnecting] = useState(false);
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [loadingNetworks, setLoadingNetworks] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<WifiNetwork | null>(null);
  const [password, setPassword] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectingSsid, setConnectingSsid] = useState<string | null>(null);
  const [hotspot, setHotspot] = useState<HotspotInfo | null>(null);
  const [hotspotStarting, setHotspotStarting] = useState(false);
  const [hotspotTimeoutError, setHotspotTimeoutError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number | null>(null);

  const countryNames = useCountryNames(supportedCountries, locale);

  const sortedCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    return supportedCountries
      .map((code) => ({ code, name: countryNames.get(code) ?? code }))
      .filter((c) => c.name.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [supportedCountries, countryNames, countrySearch, locale]);

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
    let cancelled = false;
    async function init() {
      try {
        const data = await fetchJson<CountryApiResponse>("/api/network/country");
        if (cancelled) return;
        setSupportedCountries(data.supported);
        if (data.country === null) {
          setSelectedCountry(data.supported.includes("CH") ? "CH" : null);
          setMode("country");
        } else {
          setCountryInitialized(true);
        }
      } catch {
        if (!cancelled) {
          setCountryInitialized(true);
        }
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (countryInitialized) {
      void scan();
    }
  }, [countryInitialized, scan]);

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
    pollStartRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      if (
        pollStartRef.current !== null &&
        Date.now() - pollStartRef.current > 80_000
      ) {
        stopPoll();
        await stopHotspot();
        setMode("list");
        setHotspotTimeoutError(t("hotspotTimeout"));
        return;
      }
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

  async function handleConfirmCountry() {
    if (!selectedCountry) return;
    setCountryPosting(true);
    setCountryError(null);
    try {
      await postJson("/api/network/country", { country: selectedCountry });
      setCountryInitialized(true);
      setMode("list");
      void scan();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("country.error");
      setCountryError(msg);
    } finally {
      setCountryPosting(false);
    }
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
    setHotspotTimeoutError(null);
    try {
      await scan();
      const info = await postJson<HotspotInfo>("/api/network/hotspot-start");
      setHotspot(info);
      setMode("hotspot");
      startHotspotPoll();
    } catch {
      // stay on list; user can retry
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
          {mode === "country" ? t("country.title") : t("title")}
        </h2>
        <p className="text-muted text-lg">
          {mode === "country" ? t("country.subtitle") : t("subtitle")}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {mode === "country" && (
          <motion.div
            key="country"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="flex flex-col gap-4"
          >
            <GlassCard className="p-4 overflow-hidden flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
                <input
                  type="text"
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder={t("country.searchPlaceholder")}
                  className="w-full min-h-12 rounded-2xl border border-border bg-surface pl-10 pr-4 py-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent-sky/60"
                />
              </div>

              <div className="max-h-[320px] overflow-y-auto flex flex-col gap-1">
                {sortedCountries.length === 0 && (
                  <p className="py-6 text-center text-muted text-sm">{t("country.searchPlaceholder")}</p>
                )}
                {sortedCountries.map(({ code, name }) => {
                  const isSelected = selectedCountry === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setSelectedCountry(code)}
                      className={[
                        "flex items-center gap-3 rounded-2xl px-4 min-h-[52px] w-full text-left transition-colors",
                        isSelected
                          ? "bg-accent-sky/20 border border-accent-sky/50"
                          : "hover:bg-surface border border-transparent",
                      ].join(" ")}
                    >
                      <Globe className={`size-4 shrink-0 ${isSelected ? "text-accent-sky" : "text-muted"}`} />
                      <span className={`text-sm font-medium ${isSelected ? "text-ink" : "text-ink"}`}>{name}</span>
                      <span className="ml-auto text-xs text-muted tabular-nums">{code}</span>
                    </button>
                  );
                })}
              </div>

              <AnimatePresence>
                {countryError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    role="alert"
                    className="text-sm text-accent-rose"
                  >
                    {countryError}
                  </motion.p>
                )}
              </AnimatePresence>
            </GlassCard>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="primary"
                onClick={() => void handleConfirmCountry()}
                disabled={!selectedCountry || countryPosting}
                className="min-h-12 min-w-[160px]"
              >
                {countryPosting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t("country.settingUp")}
                  </>
                ) : (
                  t("country.confirm")
                )}
              </Button>
            </div>
          </motion.div>
        )}

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

            <AnimatePresence>
              {hotspotTimeoutError && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  role="alert"
                  className="text-sm text-accent-rose"
                >
                  {hotspotTimeoutError}
                </motion.p>
              )}
            </AnimatePresence>

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
