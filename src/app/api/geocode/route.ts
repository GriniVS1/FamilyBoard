import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().min(1).max(100),
  lang: z.enum(["en", "de", "fr", "it"]).default("en"),
});

type GeocodeResult = {
  id: number;
  name: string;
  country: string | null;
  admin1: string | null;
  latitude: number;
  longitude: number;
};

type OpenMeteoGeocodeResponse = {
  results?: Array<{
    id?: number;
    name?: string;
    country?: string;
    admin1?: string;
    latitude?: number;
    longitude?: number;
  }>;
};

export const GET = withErrorHandling(async (req) => {
  const url = new URL(req.url);
  const parsed = querySchema.parse({
    q: url.searchParams.get("q") ?? undefined,
    lang: url.searchParams.get("lang") ?? undefined,
  });

  const upstreamUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  upstreamUrl.searchParams.set("name", parsed.q);
  upstreamUrl.searchParams.set("count", "8");
  upstreamUrl.searchParams.set("language", parsed.lang);
  upstreamUrl.searchParams.set("format", "json");

  const res = await fetch(upstreamUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new AppError(
      "Geocoding provider request failed",
      "GEOCODE_FAILED",
      502,
    );
  }

  const raw = (await res.json()) as OpenMeteoGeocodeResponse;

  const results: GeocodeResult[] = (raw.results ?? [])
    .filter(
      (r) =>
        typeof r.id === "number" &&
        typeof r.name === "string" &&
        typeof r.latitude === "number" &&
        typeof r.longitude === "number",
    )
    .map((r) => ({
      id: r.id as number,
      name: r.name as string,
      country: r.country ?? null,
      admin1: r.admin1 ?? null,
      latitude: r.latitude as number,
      longitude: r.longitude as number,
    }));

  return ok({ results });
});
