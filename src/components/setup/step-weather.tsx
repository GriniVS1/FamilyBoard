"use client";

import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, ChevronDown } from "lucide-react";
import { Button } from "@/components/shared/button";
import { Input } from "@/components/shared/input";
import { cn } from "@/lib/utils";
import { postJson } from "./types";

type StepWeatherProps = {
  onComplete: () => void;
  onSkip: () => void;
  onBack: () => void;
};

type FamilyResponse = {
  id: string;
  weatherLat: number | null;
  weatherLon: number | null;
  weatherLabel: string | null;
};

export function StepWeather({ onComplete, onSkip, onBack }: StepWeatherProps) {
  const [label, setLabel] = useState("");
  const [showCoords, setShowCoords] = useState(false);
  const [latStr, setLatStr] = useState("");
  const [lonStr, setLonStr] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function useMyLocation() {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGeoStatus("error");
      setError("Geolocation isn't available in this browser.");
      return;
    }
    setGeoStatus("loading");
    setError(null);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          if (!label.trim()) setLabel("My Location");
          setGeoStatus("ok");
        },
        (err) => {
          setGeoStatus("error");
          setError(
            err.code === err.PERMISSION_DENIED
              ? "Location permission denied. Enter coordinates manually."
              : "Couldn't get your location. Enter coordinates manually.",
          );
        },
        { enableHighAccuracy: false, timeout: 8000 },
      );
    } catch {
      setGeoStatus("error");
      setError("Couldn't request your location.");
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    let lat: number | null = coords?.lat ?? null;
    let lon: number | null = coords?.lon ?? null;

    if (showCoords && (latStr.trim() || lonStr.trim())) {
      const parsedLat = Number(latStr);
      const parsedLon = Number(lonStr);
      if (
        !Number.isFinite(parsedLat) ||
        !Number.isFinite(parsedLon) ||
        parsedLat < -90 ||
        parsedLat > 90 ||
        parsedLon < -180 ||
        parsedLon > 180
      ) {
        setError("Enter valid coordinates (lat -90..90, lon -180..180).");
        return;
      }
      lat = parsedLat;
      lon = parsedLon;
    }

    if (lat == null || lon == null) {
      setError(
        'Use "Use my location" or enter coordinates manually to continue.',
      );
      return;
    }

    const finalLabel = label.trim() || "My Location";

    setSubmitting(true);
    try {
      await postJson<FamilyResponse>("/api/setup/weather", {
        lat,
        lon,
        label: finalLabel,
      });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <div className="space-y-3">
        <p className="text-muted text-sm font-medium tracking-wide uppercase">
          Step 4 (optional)
        </p>
        <h2 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05]">
          Weather for your dashboard
        </h2>
        <p className="text-muted text-lg">
          Pick a place so the forecast feels at home.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="weather-label" className="text-sm font-medium text-ink">
            City or place
          </label>
          <Input
            id="weather-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Berlin, home, the cabin…"
            maxLength={60}
          />
        </div>

        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={useMyLocation}
          disabled={geoStatus === "loading"}
          className="w-full"
        >
          <MapPin className="size-5" />
          {geoStatus === "loading"
            ? "Getting location…"
            : geoStatus === "ok" && coords
              ? `Got it (${coords.lat.toFixed(2)}, ${coords.lon.toFixed(2)})`
              : "Use my location"}
        </Button>

        <div>
          <button
            type="button"
            onClick={() => setShowCoords((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors"
            aria-expanded={showCoords}
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
                <div className="grid grid-cols-2 gap-3 pt-3">
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
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {error && (
        <p className="text-sm text-accent-rose" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-between gap-3">
        <Button type="button" variant="ghost" size="lg" onClick={onBack}>
          Back
        </Button>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={onSkip}
            disabled={submitting}
          >
            Skip for now
          </Button>
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? "Saving…" : "Continue"}
          </Button>
        </div>
      </div>
    </form>
  );
}
