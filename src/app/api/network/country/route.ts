import { z } from "zod";
import { withErrorHandling, ok, AppError } from "@/lib/api";
import {
  SUPPORTED_WIFI_COUNTRIES,
  getWifiCountry,
  setRegulatoryCountry,
  NetworkError,
} from "@/lib/network";
import { db } from "@/lib/db";
import { requireNetworkAccess } from "../guard";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (req) => {
  await requireNetworkAccess(req);
  const country = await getWifiCountry();
  return ok({ country, supported: SUPPORTED_WIFI_COUNTRIES });
});

const PostBody = z.object({
  country: z
    .string()
    .regex(/^[A-Z]{2}$/, "country must be two uppercase letters")
    .refine((c) => (SUPPORTED_WIFI_COUNTRIES as readonly string[]).includes(c), {
      message: "Unsupported WiFi country code",
    }),
});

export const POST = withErrorHandling(async (req) => {
  await requireNetworkAccess(req);
  const { country } = PostBody.parse(await req.json());

  try {
    await setRegulatoryCountry(country);
  } catch (err) {
    if (err instanceof NetworkError) {
      const status = err.code === "INVALID_COUNTRY" ? 400 : 502;
      throw new AppError(err.message, err.code, status);
    }
    throw err;
  }

  await db.setting.upsert({
    where: { key: "wifi_country" },
    update: { value: country },
    create: { key: "wifi_country", value: country },
  });

  return ok({ country });
});
