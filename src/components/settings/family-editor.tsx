"use client";

import { ChevronDown, Loader2, MapPin } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";
import { Input } from "@/components/shared/input";
import { cn } from "@/lib/utils";

type FamilyData = {
  id: string;
  name: string;
  weatherLat?: number | null;
  weatherLon?: number | null;
  weatherLabel: string | null;
};

type FamilyEditorProps = {
  family: FamilyData | null;
  disabled: boolean;
  onUpdate: (patch: {
    name?: string;
    weatherLat?: number | null;
    weatherLon?: number | null;
    weatherLabel?: string | null;
  }) => Promise<FamilyData>;
};

export function FamilyEditor({ family, disabled, onUpdate }: FamilyEditorProps) {
  const [name, setName] = useState(family?.name ?? "");
  const [label, setLabel] = useState(family?.weatherLabel ?? "");
  const [latStr, setLatStr] = useState(
    family?.weatherLat != null ? String(family.weatherLat) : "",
  );
  const [lonStr, setLonStr] = useState(
    family?.weatherLon != null ? String(family.weatherLon) : "",
  );
  const [showCoords, setShowCoords] = useState(false);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle",
  );
  const [savingName, setSavingName] = useState(false);
  const [savingWeather, setSavingWeather] = useState(false);
  const [nameOk, setNameOk] = useState(false);
  const [weatherOk, setWeatherOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSaveName(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    setSavingName(true);
    setError(null);
    setNameOk(false);
    try {
      await onUpdate({ name: name.trim() });
      setNameOk(true);
      window.setTimeout(() => setNameOk(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSavingName(false);
    }
  }

  function useMyLocation() {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGeoStatus("error");
      setError("Geolocation isn't available in this browser.");
      return;
    }
    setGeoStatus("loading");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatStr(pos.coords.latitude.toFixed(4));
        setLonStr(pos.coords.longitude.toFixed(4));
        setGeoStatus("ok");
        if (!label.trim()) setLabel("My Location");
      },
      (err) => {
        setGeoStatus("error");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied."
            : "Couldn't get your location.",
        );
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  async function handleSaveWeather(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setWeatherOk(false);

    const lat = Number(latStr);
    const lon = Number(lonStr);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      setError("Enter valid coordinates (lat -90..90, lon -180..180).");
      return;
    }
    if (!label.trim()) {
      setError("Give the location a label.");
      return;
    }
    setSavingWeather(true);
    try {
      await onUpdate({
        weatherLat: lat,
        weatherLon: lon,
        weatherLabel: label.trim(),
      });
      setWeatherOk(true);
      window.setTimeout(() => setWeatherOk(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSavingWeather(false);
    }
  }

  return (
    <GlassCard className="flex flex-col gap-6 p-6">
      <div className="space-y-1">
        <h2 className="font-display text-xl text-ink">Family</h2>
        <p className="text-sm text-muted">Name and dashboard weather location.</p>
      </div>

      <form onSubmit={handleSaveName} className="flex flex-col gap-3">
        <label
          htmlFor="family-name"
          className="text-xs font-semibold uppercase tracking-wider text-muted"
        >
          Family name
        </label>
        <div className="flex gap-2">
          <Input
            id="family-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={disabled || savingName}
            maxLength={60}
            placeholder="The Smith Family"
            className="flex-1"
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={disabled || savingName || !name.trim()}
          >
            {savingName ? <Loader2 className="size-4 animate-spin" /> : "Save"}
          </Button>
        </div>
        {nameOk && (
          <p className="text-xs text-accent-mint">Saved.</p>
        )}
      </form>

      <div className="h-px bg-border" />

      <form onSubmit={handleSaveWeather} className="flex flex-col gap-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted">
          Weather location
        </label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Berlin, home, the cabin…"
          disabled={disabled || savingWeather}
          maxLength={60}
        />

        <Button
          type="button"
          variant="secondary"
          onClick={useMyLocation}
          disabled={disabled || geoStatus === "loading"}
          className="w-full"
        >
          <MapPin className="size-5" />
          {geoStatus === "loading"
            ? "Getting location…"
            : geoStatus === "ok"
              ? `Got it (${Number(latStr).toFixed(2)}, ${Number(lonStr).toFixed(2)})`
              : "Use my location"}
        </Button>

        <button
          type="button"
          onClick={() => setShowCoords((v) => !v)}
          disabled={disabled}
          aria-expanded={showCoords}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors disabled:opacity-50"
        >
          <ChevronDown
            className={cn(
              "size-4 transition-transform",
              showCoords && "rotate-180",
            )}
          />
          Enter coordinates manually
        </button>

        <AnimatePresence initial={false}>
          {showCoords && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <label htmlFor="lat" className="text-xs text-muted">
                    Latitude
                  </label>
                  <Input
                    id="lat"
                    inputMode="decimal"
                    value={latStr}
                    onChange={(e) => setLatStr(e.target.value)}
                    placeholder="52.52"
                    disabled={disabled || savingWeather}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="lon" className="text-xs text-muted">
                    Longitude
                  </label>
                  <Input
                    id="lon"
                    inputMode="decimal"
                    value={lonStr}
                    onChange={(e) => setLonStr(e.target.value)}
                    placeholder="13.40"
                    disabled={disabled || savingWeather}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="submit"
            disabled={disabled || savingWeather}
          >
            {savingWeather ? <Loader2 className="size-4 animate-spin" /> : "Save weather"}
          </Button>
        </div>
        {weatherOk && (
          <p className="text-xs text-accent-mint">Saved.</p>
        )}
      </form>

      {error && (
        <p role="alert" className="text-sm text-accent-rose">
          {error}
        </p>
      )}
    </GlassCard>
  );
}
