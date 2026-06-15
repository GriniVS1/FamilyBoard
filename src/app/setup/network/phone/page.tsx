"use client";

import { useEffect, useState } from "react";
import { Wifi, Info, Loader2, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

type WifiNetwork = {
  ssid: string;
  signal: number;
  secured: boolean;
};

type Phase = "scan" | "password" | "submitted";

async function fetchNetworks(): Promise<WifiNetwork[]> {
  const res = await fetch("/api/network/wifi-scan?cached=1");
  if (!res.ok) throw new Error("scan failed");
  const data = (await res.json()) as { networks: WifiNetwork[] };
  return data.networks;
}

async function submitWifi(ssid: string, psk?: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    await fetch("/api/network/wifi-connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ssid, psk, viaHotspot: true }),
      signal: controller.signal,
    });
  } catch {
    // Hotspot teardown will kill the connection — treat any error (including
    // abort / network drop) as expected and not a failure.
  } finally {
    clearTimeout(timer);
  }
}

export default function PhonePage() {
  const t = useTranslations("setup.network");
  const tCommon = useTranslations("common");
  const [phase, setPhase] = useState<Phase>("scan");
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WifiNetwork | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function scan() {
    setLoading(true);
    setError(null);
    try {
      const nets = await fetchNetworks();
      setNetworks(nets);
      setPhase("scan");
    } catch {
      setError(t("connectFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void scan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickNetwork(net: WifiNetwork) {
    setSelected(net);
    setPassword("");
    setError(null);
    if (!net.secured) {
      void submitAndFinish(net.ssid, undefined);
    } else {
      setPhase("password");
    }
  }

  async function submitAndFinish(ssid: string, psk: string | undefined) {
    await submitWifi(ssid, psk);
    setPhase("submitted");
  }

  return (
    <div className="min-h-screen bg-bg text-ink font-sans">
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="size-10 rounded-2xl bg-accent-sky/30 flex items-center justify-center">
            <Wifi className="size-5 text-ink" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-tight">{t("title")}</h1>
            <p className="text-sm text-muted">{t("subtitle")}</p>
          </div>
        </div>

        {phase === "submitted" && (
          <div className="flex flex-col items-center gap-6 py-12 text-center">
            <div className="size-16 rounded-full bg-accent-mint/20 flex items-center justify-center">
              <Info className="size-8 text-accent-mint" />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold">{t("phone.submittedTitle")}</h2>
              <p className="text-muted leading-relaxed max-w-sm">{t("phone.submittedBody")}</p>
            </div>
          </div>
        )}

        {phase === "scan" && (
          <div className="flex flex-col gap-4">
            {loading ? (
              <div className="flex items-center gap-2 py-8 text-muted">
                <Loader2 className="size-5 animate-spin" />
                <span>{t("scanning")}</span>
              </div>
            ) : (
              <>
                {error && (
                  <p className="text-sm text-accent-rose mb-2">{error}</p>
                )}
                <ul className="flex flex-col gap-2">
                  {networks.map((net) => (
                    <li key={net.ssid}>
                      <button
                        type="button"
                        onClick={() => pickNetwork(net)}
                        className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl border border-border bg-surface text-left active:scale-[0.98] transition-transform tap-target"
                      >
                        <Wifi className="size-5 shrink-0 text-muted" />
                        <span className="flex-1 font-medium truncate">{net.ssid}</span>
                        <span className="text-xs text-muted">{net.signal}%</span>
                      </button>
                    </li>
                  ))}
                  {networks.length === 0 && (
                    <p className="text-sm text-muted py-4">{t("empty")}</p>
                  )}
                </ul>
                <button
                  type="button"
                  onClick={() => void scan()}
                  className="flex items-center gap-2 text-sm text-muted mt-2 tap-target"
                >
                  <RefreshCw className="size-4" />
                  {t("rescan")}
                </button>
              </>
            )}
          </div>
        )}

        {phase === "password" && selected && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-medium">
              {t("passwordFor", { ssid: selected.ssid })}
            </h2>
            {error && (
              <p className="text-sm text-accent-rose">{error}</p>
            )}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("passwordPlaceholder")}
              autoFocus
              className="w-full h-14 px-4 rounded-2xl border border-border bg-surface text-base outline-none text-ink"
            />
            <button
              type="button"
              onClick={() => void submitAndFinish(selected.ssid, password || undefined)}
              disabled={password.length === 0}
              className="h-14 rounded-full bg-ink text-bg font-medium disabled:opacity-40 active:scale-[0.98] transition-transform tap-target w-full"
            >
              {t("connect")}
            </button>
            <button
              type="button"
              onClick={() => setPhase("scan")}
              className="text-sm text-muted text-center tap-target"
            >
              {tCommon("back")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
