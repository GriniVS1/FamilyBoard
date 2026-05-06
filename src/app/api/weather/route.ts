import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 10 * 60 * 1000;

type WeatherNow = {
  tempC: number;
  code: number;
  isDay: boolean;
  windKmh: number;
};

type WeatherHourly = { ts: string; tempC: number; code: number };

type WeatherDaily = {
  date: string;
  minC: number;
  maxC: number;
  code: number;
  sunrise: string;
  sunset: string;
};

type WeatherResponse = {
  label: string;
  now: WeatherNow;
  hourly: WeatherHourly[];
  daily: WeatherDaily[];
};

type CacheEntry = { data: WeatherResponse; expires: number };

const cache = new Map<string, CacheEntry>();

type OpenMeteoResponse = {
  current?: {
    time?: string;
    temperature_2m?: number;
    weather_code?: number;
    is_day?: number;
    wind_speed_10m?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    weather_code?: number[];
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    weather_code?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
};

function buildResponse(
  label: string,
  raw: OpenMeteoResponse,
): WeatherResponse {
  const current = raw.current;
  if (
    !current ||
    typeof current.temperature_2m !== "number" ||
    typeof current.weather_code !== "number" ||
    typeof current.is_day !== "number" ||
    typeof current.wind_speed_10m !== "number"
  ) {
    throw new AppError(
      "Weather provider returned unexpected response",
      "WEATHER_PROVIDER_ERROR",
      502,
    );
  }

  const now: WeatherNow = {
    tempC: current.temperature_2m,
    code: current.weather_code,
    isDay: current.is_day === 1,
    windKmh: current.wind_speed_10m,
  };

  const hourlyTimes = raw.hourly?.time ?? [];
  const hourlyTemps = raw.hourly?.temperature_2m ?? [];
  const hourlyCodes = raw.hourly?.weather_code ?? [];

  const currentMs = current.time ? new Date(current.time).getTime() : Date.now();
  let startIdx = 0;
  for (let i = 0; i < hourlyTimes.length; i++) {
    if (new Date(hourlyTimes[i]).getTime() >= currentMs) {
      startIdx = i;
      break;
    }
  }

  const hourly: WeatherHourly[] = [];
  for (
    let i = startIdx;
    i < hourlyTimes.length && hourly.length < 12;
    i++
  ) {
    const t = hourlyTimes[i];
    const temp = hourlyTemps[i];
    const code = hourlyCodes[i];
    if (typeof t === "string" && typeof temp === "number" && typeof code === "number") {
      hourly.push({ ts: t, tempC: temp, code });
    }
  }

  const dailyTimes = raw.daily?.time ?? [];
  const dailyMax = raw.daily?.temperature_2m_max ?? [];
  const dailyMin = raw.daily?.temperature_2m_min ?? [];
  const dailyCodes = raw.daily?.weather_code ?? [];
  const dailySunrise = raw.daily?.sunrise ?? [];
  const dailySunset = raw.daily?.sunset ?? [];

  const daily: WeatherDaily[] = [];
  for (let i = 0; i < dailyTimes.length; i++) {
    const date = dailyTimes[i];
    const maxC = dailyMax[i];
    const minC = dailyMin[i];
    const code = dailyCodes[i];
    const sunrise = dailySunrise[i];
    const sunset = dailySunset[i];
    if (
      typeof date === "string" &&
      typeof maxC === "number" &&
      typeof minC === "number" &&
      typeof code === "number" &&
      typeof sunrise === "string" &&
      typeof sunset === "string"
    ) {
      daily.push({ date, minC, maxC, code, sunrise, sunset });
    }
  }

  return { label, now, hourly, daily };
}

export const GET = withErrorHandling(async () => {
  const family = await db.family.findFirst();
  if (!family) {
    throw new AppError("Family not found", "FAMILY_NOT_FOUND", 400);
  }
  if (
    family.weatherLat == null ||
    family.weatherLon == null ||
    !family.weatherLabel
  ) {
    throw new AppError(
      "Weather location is not configured",
      "WEATHER_NOT_CONFIGURED",
      400,
    );
  }

  const lat = family.weatherLat;
  const lon = family.weatherLon;
  const cacheKey = `${lat},${lon}`;
  const nowMs = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > nowMs) {
    return ok({ ...cached.data, label: family.weatherLabel });
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "current",
    "temperature_2m,weather_code,is_day,wind_speed_10m",
  );
  url.searchParams.set("hourly", "temperature_2m,weather_code");
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset",
  );
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "3");

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new AppError(
      `Weather provider responded ${res.status}`,
      "WEATHER_PROVIDER_ERROR",
      502,
    );
  }
  const raw = (await res.json()) as OpenMeteoResponse;
  const data = buildResponse(family.weatherLabel, raw);

  cache.set(cacheKey, { data, expires: nowMs + CACHE_TTL_MS });

  return ok(data);
});
