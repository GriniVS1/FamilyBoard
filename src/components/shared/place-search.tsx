"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { Input } from "@/components/shared/input";
import { InlineKeyboardPanel } from "@/components/setup/inline-keyboard-panel";
import { cn } from "@/lib/utils";

export type GeocodeResult = {
  id: number;
  name: string;
  country: string;
  admin1: string | null;
  latitude: number;
  longitude: number;
};

type GeocodeResponse = {
  results: GeocodeResult[];
};

type PlaceSearchProps = {
  locale: string;
  value: string;
  onValueChange: (value: string) => void;
  onPick: (result: GeocodeResult) => void;
  placeholder?: string;
  disabled?: boolean;
  inputId?: string;
  noResultsLabel: string;
  searchErrorLabel: string;
};

function formatResult(result: GeocodeResult): string {
  const parts = [result.name, result.admin1, result.country].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  return parts.join(", ");
}

export function PlaceSearch({
  locale,
  value,
  onValueChange,
  onPick,
  placeholder,
  disabled = false,
  inputId,
  noResultsLabel,
  searchErrorLabel,
}: PlaceSearchProps) {
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const query = value.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }

    debounceRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      setStatus("loading");
      fetch(`/api/geocode?q=${encodeURIComponent(query)}&lang=${encodeURIComponent(locale)}`)
        .then((res) => {
          if (!res.ok) throw new Error("geocode failed");
          return res.json() as Promise<GeocodeResponse>;
        })
        .then((data) => {
          if (requestIdRef.current !== requestId) return;
          setResults(data.results ?? []);
          setStatus("idle");
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) return;
          setResults([]);
          setStatus("error");
        });
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, locale]);

  const showDropdown =
    !dismissed &&
    value.trim().length >= 2 &&
    (results.length > 0 || status === "loading" || status === "error");

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <Input
          id={inputId}
          value={value}
          onChange={(e) => {
            onValueChange(e.target.value);
            setDismissed(false);
          }}
          onFocus={() => {
            setKeyboardOpen(true);
            setDismissed(false);
          }}
          onBlur={() => setKeyboardOpen(false)}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={60}
          className="pl-12"
          autoComplete="off"
        />
        {status === "loading" && (
          <Loader2 className="absolute right-4 top-1/2 size-5 -translate-y-1/2 animate-spin text-muted" />
        )}
      </div>

      {showDropdown && (
        <div className="rounded-2xl border border-border bg-surface shadow-soft overflow-hidden">
          {status === "error" && (
            <p className="px-4 py-3 text-sm text-muted">{searchErrorLabel}</p>
          )}
          {status !== "error" && status !== "loading" && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted">{noResultsLabel}</p>
          )}
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(result);
                setResults([]);
                setDismissed(true);
                setKeyboardOpen(false);
              }}
              className={cn(
                "flex w-full min-h-12 items-center gap-3 px-4 py-3 text-left transition-colors",
                "hover:bg-bg tap-target border-b border-border last:border-b-0",
              )}
            >
              <MapPin className="size-4 shrink-0 text-muted" />
              <span className="text-sm text-ink truncate">{formatResult(result)}</span>
            </button>
          ))}
        </div>
      )}

      <InlineKeyboardPanel open={keyboardOpen} value={value} onChange={onValueChange} />
    </div>
  );
}
